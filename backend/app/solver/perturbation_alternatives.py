"""Find up to three distinct perturbation-only recovery alternatives.

Ranking is lexicographic:
1. Keep the number of OTHER time/room changes at the true minimum.
2. Among those minimum-disruption recoveries, use the user's existing
   weighted timetable objective to rank the best remaining alternatives.

The target session is never counted as a perturbation. For every OTHER session,
a time change counts as one perturbation and a room change counts as one perturbation.
"""

from __future__ import annotations

from typing import Any

from ortools.sat.python import cp_model

from app.schemas import RescheduleRequestIn
from app.models import Session
from app.solver.reschedule import (
    build_pre_solve_context,
    build_solver_model,
    build_min_perturbation_solver_model,
    get_existing_breakable_violations,
    build_baseline_violation_context,
    datetime_to_slot,
    get_duration_slots,
    get_valid_start_slots,
    SLOTS_PER_DAY,
    get_active_class_capacity_sessions,
    get_active_class_equipment_sessions,
    get_active_cohort_daily_hour_constraints,
    get_active_lecturer_daily_hour_constraints,
    get_active_lecturer_lunch_constraints,
    get_all_lecturer_unavailability,
    get_lecturers,
    get_rooms,
    slot_to_day_time,
    solve_reschedule_min_perturbation,
)

from app.solver.timetable_impact import (
    build_baseline_assignments,
    evaluate_timetable,
    compare_timetable_impacts,
)


def _add_perturbation_vars(
    model,
    other_sessions,
    start_vars,
    room_vars,
    room_id_to_index,
):
    time_changed_vars = {}
    room_changed_vars = {}

    for session in other_sessions:
        sid = session.id

        original_start = datetime_to_slot(session.start)
        original_room = room_id_to_index[session.room_id]

        time_changed = model.NewBoolVar(f"time_changed_{sid}")
        room_changed = model.NewBoolVar(f"room_changed_{sid}")

        model.Add(
            start_vars[sid] != original_start
        ).OnlyEnforceIf(time_changed)

        model.Add(
            start_vars[sid] == original_start
        ).OnlyEnforceIf(time_changed.Not())

        model.Add(
            room_vars[sid] != original_room
        ).OnlyEnforceIf(room_changed)

        model.Add(
            room_vars[sid] == original_room
        ).OnlyEnforceIf(room_changed.Not())

        time_changed_vars[sid] = time_changed
        room_changed_vars[sid] = room_changed

    return time_changed_vars, room_changed_vars


def _add_no_good_constraint(
    model: cp_model.CpModel,
    *,
    solution_number: int,
    all_sessions,
    solver: cp_model.CpSolver,
    start_vars,
    room_vars,
):
    """Prevent the next solve from returning this exact time/room timetable."""
    differences = []

    for session in all_sessions:
        sid = session.id
        solved_start = solver.Value(start_vars[sid])
        solved_room = solver.Value(room_vars[sid])

        start_different = model.NewBoolVar(
            f"nogood_{solution_number}_start_{sid}"
        )
        room_different = model.NewBoolVar(
            f"nogood_{solution_number}_room_{sid}"
        )

        model.Add(start_vars[sid] != solved_start).OnlyEnforceIf(start_different)
        model.Add(start_vars[sid] == solved_start).OnlyEnforceIf(
            start_different.Not()
        )

        model.Add(room_vars[sid] != solved_room).OnlyEnforceIf(room_different)
        model.Add(room_vars[sid] == solved_room).OnlyEnforceIf(
            room_different.Not()
        )

        differences.extend([start_different, room_different])

    if differences:
        model.AddBoolOr(differences)



def _add_recovery_objective(
    model, all_sessions, rooms, lecturers, start_vars, room_vars, lecturer_vars,
    active_capacity_sessions, request,
):
    """Score the resulting recovery timetable even for a concrete target request."""
    weights = request.objective_weights
    terms = []
    debug = {
        "room_waste": None,
        "cohort_gap_penalty": None,
        "lecturer_idle_penalty": None,
        "cohort_room_change_penalty": None,
    }

    def or_eq(out, xs):
        if not xs:
            model.Add(out == 0); return
        model.AddBoolOr(xs).OnlyEnforceIf(out)
        model.AddBoolAnd([x.Not() for x in xs]).OnlyEnforceIf(out.Not())

    def and_eq(out, xs):
        model.AddBoolAnd(xs).OnlyEnforceIf(out)
        model.AddBoolOr([x.Not() for x in xs]).OnlyEnforceIf(out.Not())

    def covers(session, slot, prefix):
        duration = get_duration_slots(session)
        starts = get_valid_start_slots(duration)
        valid = [s for s in starts if s <= slot < s + duration and s // SLOTS_PER_DAY == slot // SLOTS_PER_DAY]
        b = model.NewBoolVar(f"{prefix}_{session.id}_{slot}")
        model.AddAllowedAssignments([start_vars[session.id], b], [[s, 1 if s in valid else 0] for s in starts])
        return b

    # Room waste: score all active capacity-constrained sessions, including moved sessions.
    waste_vars = []
    for session in all_sessions:
        if session.id not in active_capacity_sessions or session.module.required_capacity is None:
            continue
        wastes = [max(0, room.capacity - session.module.required_capacity) for room in rooms]
        v = model.NewIntVar(min(wastes), max(wastes), f"recovery_waste_{session.id}")
        model.AddElement(room_vars[session.id], wastes, v)
        waste_vars.append(v)
    if waste_vars:
        total = model.NewIntVar(0, sum(max(v) for v in [[max(0, r.capacity - s.module.required_capacity) for r in rooms] for s in all_sessions if s.id in active_capacity_sessions and s.module.required_capacity is not None]), "recovery_room_waste")
        model.Add(total == sum(waste_vars))
        debug["room_waste"] = total
        terms.append(weights.room_waste * total)

    cohort_map = {}
    for session in all_sessions:
        for cohort in session.cohorts:
            cohort_map.setdefault(cohort.id, []).append(session)

    # Cohort gaps.
    gaps = []
    for cohort_id, sessions in cohort_map.items():
        for day in range(5):
            first = day * SLOTS_PER_DAY + 1
            slots = list(range(first, first + SLOTS_PER_DAY))
            occupied = {}
            for slot in slots:
                o = model.NewBoolVar(f"recovery_cohort_occ_{cohort_id}_{slot}")
                or_eq(o, [covers(s, slot, f"recovery_cohort_cover_{cohort_id}") for s in sessions])
                occupied[slot] = o
            for i in range(1, len(slots)-1):
                slot = slots[i]
                before = model.NewBoolVar(f"recovery_cohort_before_{cohort_id}_{slot}")
                after = model.NewBoolVar(f"recovery_cohort_after_{cohort_id}_{slot}")
                or_eq(before, [occupied[s] for s in slots[:i]])
                or_eq(after, [occupied[s] for s in slots[i+1:]])
                gap = model.NewBoolVar(f"recovery_gap_{cohort_id}_{slot}")
                and_eq(gap, [occupied[slot].Not(), before, after])
                gaps.append(gap)
    if gaps:
        total = model.NewIntVar(0, len(gaps), "recovery_cohort_gaps")
        model.Add(total == sum(gaps)); debug["cohort_gap_penalty"] = total
        terms.append(weights.cohort_gaps * total)

    # Lecturer idle slots.
    idle_vars = []
    lecturer_index = {l.id: i for i, l in enumerate(lecturers)}
    for lecturer_id, li in lecturer_index.items():
        for day in range(5):
            first = day * SLOTS_PER_DAY + 1
            slots = list(range(first, first + SLOTS_PER_DAY))
            occupied = {}
            for slot in slots:
                cs = []
                for session in all_sessions:
                    time_cover = covers(session, slot, f"recovery_lect_time_{lecturer_id}")
                    assigned = model.NewBoolVar(f"recovery_assigned_{lecturer_id}_{session.id}_{slot}")
                    model.Add(lecturer_vars[session.id] == li).OnlyEnforceIf(assigned)
                    model.Add(lecturer_vars[session.id] != li).OnlyEnforceIf(assigned.Not())
                    c = model.NewBoolVar(f"recovery_lect_cover_{lecturer_id}_{session.id}_{slot}")
                    and_eq(c, [assigned, time_cover]); cs.append(c)
                o = model.NewBoolVar(f"recovery_lect_occ_{lecturer_id}_{slot}")
                or_eq(o, cs); occupied[slot] = o
            for i in range(1, len(slots)-1):
                slot = slots[i]
                before = model.NewBoolVar(f"recovery_lect_before_{lecturer_id}_{slot}")
                after = model.NewBoolVar(f"recovery_lect_after_{lecturer_id}_{slot}")
                or_eq(before, [occupied[s] for s in slots[:i]])
                or_eq(after, [occupied[s] for s in slots[i+1:]])
                idle = model.NewBoolVar(f"recovery_idle_{lecturer_id}_{slot}")
                and_eq(idle, [occupied[slot].Not(), before, after]); idle_vars.append(idle)
    if idle_vars:
        total = model.NewIntVar(0, len(idle_vars), "recovery_lecturer_idle")
        model.Add(total == sum(idle_vars)); debug["lecturer_idle_penalty"] = total
        terms.append(weights.lecturer_idle * total)

    # Back-to-back cohort room changes.
    changes = []
    for cohort_id, sessions in cohort_map.items():
        for i in range(len(sessions)):
            for j in range(i+1, len(sessions)):
                a, b = sessions[i], sessions[j]
                ad, bd = get_duration_slots(a), get_duration_slots(b)
                ab = model.NewBoolVar(f"recovery_adj_{cohort_id}_{a.id}_{b.id}")
                ba = model.NewBoolVar(f"recovery_adj_{cohort_id}_{b.id}_{a.id}")
                model.Add(start_vars[b.id] == start_vars[a.id] + ad).OnlyEnforceIf(ab)
                model.Add(start_vars[b.id] != start_vars[a.id] + ad).OnlyEnforceIf(ab.Not())
                model.Add(start_vars[a.id] == start_vars[b.id] + bd).OnlyEnforceIf(ba)
                model.Add(start_vars[a.id] != start_vars[b.id] + bd).OnlyEnforceIf(ba.Not())
                b2b = model.NewBoolVar(f"recovery_b2b_{cohort_id}_{a.id}_{b.id}"); or_eq(b2b, [ab, ba])
                diff = model.NewBoolVar(f"recovery_room_diff_{cohort_id}_{a.id}_{b.id}")
                model.Add(room_vars[a.id] != room_vars[b.id]).OnlyEnforceIf(diff)
                model.Add(room_vars[a.id] == room_vars[b.id]).OnlyEnforceIf(diff.Not())
                ch = model.NewBoolVar(f"recovery_room_change_{cohort_id}_{a.id}_{b.id}")
                and_eq(ch, [b2b, diff]); changes.append(ch)
    if changes:
        total = model.NewIntVar(0, len(changes), "recovery_room_changes")
        model.Add(total == sum(changes)); debug["cohort_room_change_penalty"] = total
        terms.append(weights.cohort_room_changes * total)

    if terms:
        model.Minimize(sum(terms))
    return debug

def _objective_breakdown(
    solver: cp_model.CpSolver,
    objective_debug_vars: dict[str, Any],
    request: RescheduleRequestIn,
):
    def value(name: str):
        var = objective_debug_vars.get(name)
        return solver.Value(var) if var is not None else None

    weights = request.objective_weights

    return {
        "room_waste": value("room_waste"),
        "cohort_gaps": value("cohort_gap_penalty"),
        "lecturer_idle": value("lecturer_idle_penalty"),
        "cohort_room_changes": value("cohort_room_change_penalty"),
        "weights": {
            "room_waste": weights.room_waste,
            "cohort_gaps": weights.cohort_gaps,
            "lecturer_idle": weights.lecturer_idle,
            "cohort_room_changes": weights.cohort_room_changes,
        },
    }



def _extract_complete_assignments(
    *,
    solver: cp_model.CpSolver,
    all_sessions,
    start_vars,
    room_vars,
    lecturer_vars,
    index_to_room_id,
    index_to_lecturer_id,
):
    """Extract the complete solved timetable needed by the impact evaluator."""
    return {
        session.id: {
            "start_slot": solver.Value(start_vars[session.id]),
            "room_id": index_to_room_id[
                solver.Value(room_vars[session.id])
            ],
            "lecturer_id": index_to_lecturer_id[
                solver.Value(lecturer_vars[session.id])
            ],
        }
        for session in all_sessions
    }

def _extract_solution(
    *,
    rank: int,
    solver: cp_model.CpSolver,
    target_session: Session,
    other_sessions,
    start_vars,
    room_vars,
    lecturer_vars,
    index_to_room_id,
    index_to_lecturer_id,
    room_id_to_index,
    time_changed_vars,
    room_changed_vars,
    objective_debug_vars,
    request: RescheduleRequestIn,
):
    target_id = target_session.id
    solved_start_slot = solver.Value(start_vars[target_id])
    solved_time = slot_to_day_time(solved_start_slot)

    additional_changes = []

    for session in other_sessions:
        sid = session.id

        time_changed = solver.Value(time_changed_vars[sid]) == 1
        room_changed = solver.Value(room_changed_vars[sid]) == 1

        if not time_changed and not room_changed:
            continue

        solved_start = solver.Value(start_vars[sid])
        solved_room_index = solver.Value(room_vars[sid])
        original_start = datetime_to_slot(session.start)
        original_room_index = room_id_to_index[session.room_id]
        solved_session_time = slot_to_day_time(solved_start)

        additional_changes.append(
            {
                "session_id": sid,
                "time_changed": time_changed,
                "old_start_slot": original_start,
                "new_start_slot": solved_start,
                "old_day": session.start.strftime("%A").lower(),
                "old_time": session.start.strftime("%H:%M"),
                "new_day": solved_session_time["day"],
                "new_time": solved_session_time["time"],
                "room_changed": room_changed,
                "old_room_id": session.room_id,
                "new_room_id": index_to_room_id[solved_room_index],
            }
        )

    objective_score = float(solver.ObjectiveValue())

    return {
        "rank": rank,
        "objective_score": objective_score,
        "objective_breakdown": _objective_breakdown(
            solver, objective_debug_vars, request
        ),
        "session_id": target_id,
        "start_slot": solved_start_slot,
        "day": solved_time["day"],
        "time": solved_time["time"],
        "room_id": index_to_room_id[solver.Value(room_vars[target_id])],
        "lecturer_id": index_to_lecturer_id[
            solver.Value(lecturer_vars[target_id])
        ],
        "additional_changes": additional_changes,
        "perturbation_count": sum(
            int(change["time_changed"]) + int(change["room_changed"])
            for change in additional_changes
        ),
    }


def find_perturbation_alternatives(
    request: RescheduleRequestIn,
    db,
    max_solutions: int = 3,
):
    """Return up to three distinct minimum-perturbation weighted alternatives."""
    #max_solutions = max(1, min(max_solutions, 3))
    max_solutions = 3

    # 1. Validate and obtain target/other sessions.
    pre_solve = build_pre_solve_context(request, db)

    if pre_solve["status"] != "ready":
        return {
            "status": pre_solve["status"],
            "reason": pre_solve.get("reason"),
            "minimum_perturbations": None,
            "solution_count": 0,
            "solutions": [],
        }

    target_session: Session = pre_solve["target_session"]
    change_plan = pre_solve["change_plan"]
    other_sessions = pre_solve["other_sessions"]

    # 2. Ask the existing perturbation-only solver for the true minimum
    #    number of OTHER time/room changes required.
    minimum_result = solve_reschedule_min_perturbation(request, db)

    if minimum_result.get("status") != "feasible":
        return {
            "status": "infeasible",
            "reason": minimum_result.get(
                "reason",
                "No feasible perturbation-only recovery exists.",
            ),
            "minimum_perturbations": None,
            "solution_count": 0,
            "solutions": [],
        }

    minimum_perturbations = int(
        minimum_result.get(
            "perturbation_count",
            len(minimum_result.get("additional_changes", [])),
        )
    )

    # 3. Load active timetable data.
    rooms = get_rooms(db)
    lecturers = get_lecturers(db)
    unavailability_rows = get_all_lecturer_unavailability(db)
    active_capacity_sessions = get_active_class_capacity_sessions(db)
    active_equipment_sessions = get_active_class_equipment_sessions(db)
    cohort_daily_constraints = get_active_cohort_daily_hour_constraints(db)
    lecturer_daily_constraints = get_active_lecturer_daily_hour_constraints(db)
    lecturer_lunch_constraints = get_active_lecturer_lunch_constraints(db)

    # Perturbation-only recovery keeps every active constraint enforced.
    # Do not apply temporary deactivations here.

    # 4. Build the SAME baseline-aware perturbation model used to establish
    #    the true minimum. Existing breakable violations are baseline state;
    #    the alternatives model must not silently require them to be repaired.
    baseline_violations = get_existing_breakable_violations(db)
    baseline_context = build_baseline_violation_context(baseline_violations)

    (
        model,
        start_vars,
        room_vars,
        lecturer_vars,
        index_to_room_id,
        index_to_lecturer_id,
        room_id_to_index,
        time_changed_vars,
        room_changed_vars,
    ) = build_min_perturbation_solver_model(
        target_session=target_session,
        change_plan=change_plan,
        other_sessions=other_sessions,
        rooms=rooms,
        lecturers=lecturers,
        unavailability_rows=unavailability_rows,
        active_capacity_sessions=active_capacity_sessions,
        active_equipment_sessions=active_equipment_sessions,
        cohort_daily_constraints=cohort_daily_constraints,
        lecturer_daily_constraints=lecturer_daily_constraints,
        lecturer_lunch_constraints=lecturer_lunch_constraints,
        baseline_context=baseline_context,
    )

    # Every alternative must use exactly the true minimum number of
    # perturbations. A time change is 1 and a room change is 1.
    perturbation_vars = [
        *time_changed_vars.values(),
        *room_changed_vars.values(),
    ]
    if perturbation_vars:
        model.Add(sum(perturbation_vars) == minimum_perturbations)
    elif minimum_perturbations != 0:
        return {
            "status": "infeasible",
            "reason": "Minimum perturbation count is inconsistent.",
            "minimum_perturbations": minimum_perturbations,
            "solution_count": 0,
            "solutions": [],
        }

    all_sessions = [*other_sessions, target_session]

    # Evaluate the CURRENT timetable once. Every recovery alternative is
    # compared against this same baseline.
    baseline_assignments = build_baseline_assignments(all_sessions)
    baseline_impact = evaluate_timetable(
        sessions=all_sessions,
        rooms=rooms,
        assignments=baseline_assignments,
        objective_weights=request.objective_weights,
        active_capacity_sessions=set(active_capacity_sessions),
        # The recovery objective in this file does not exclude lunch slots
        # from lecturer idle, so lunch_slots is intentionally omitted.
    )

    # Replace the normal FIND-gated objective with a recovery objective that
    # scores the resulting timetable for this concrete request.
    objective_debug_vars = _add_recovery_objective(
        model,
        all_sessions,
        rooms,
        lecturers,
        start_vars,
        room_vars,
        lecturer_vars,
        active_capacity_sessions,
        request,
    )

    # 5. Solve -> exclude exact timetable -> solve again, up to three times.
    #    The recovery objective ranks each remaining distinct timetable.
    solutions = []

    for solution_index in range(max_solutions):
        solver = cp_model.CpSolver()
        status = solver.Solve(model)

        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            break

        solution = _extract_solution(
            rank=solution_index + 1,
            solver=solver,
            target_session=target_session,
            other_sessions=other_sessions,
            start_vars=start_vars,
            room_vars=room_vars,
            lecturer_vars=lecturer_vars,
            index_to_room_id=index_to_room_id,
            index_to_lecturer_id=index_to_lecturer_id,
            room_id_to_index=room_id_to_index,
            time_changed_vars=time_changed_vars,
            room_changed_vars=room_changed_vars,
            objective_debug_vars=objective_debug_vars,
            request=request,
        )
        solution["proven_optimal_for_remaining_model"] = (
                status == cp_model.OPTIMAL
        )

        proposed_assignments = _extract_complete_assignments(
            solver=solver,
            all_sessions=all_sessions,
            start_vars=start_vars,
            room_vars=room_vars,
            lecturer_vars=lecturer_vars,
            index_to_room_id=index_to_room_id,
            index_to_lecturer_id=index_to_lecturer_id,
        )

        proposed_impact = evaluate_timetable(
            sessions=all_sessions,
            rooms=rooms,
            assignments=proposed_assignments,
            objective_weights=request.objective_weights,
            active_capacity_sessions=set(active_capacity_sessions),
        )

        solution["impact"] = compare_timetable_impacts(
            baseline_impact,
            proposed_impact,
        )

        solutions.append(solution)

        # ---------------------------------------------------------
        # DEBUG: show which sessions this solution actually moved
        # ---------------------------------------------------------
        # ---------------------------------------------------------
        # DEBUG: show which sessions this solution actually moved
        # ---------------------------------------------------------
        moved_ids = [
            change["session_id"]
            for change in solution["additional_changes"]
        ]

        # ---------------------------------------------------------
        # DEBUG: show exactly where session-13 and session-16 moved
        # ---------------------------------------------------------
        print(f"\n[DEBUG solution {solution_index + 1}]")
        print(
            f"score={solution['objective_score']} "
            f"perturbations={solution['perturbation_count']} "
            f"objectives={solution['objective_breakdown']}"
        )

        print("Changed sessions:")

        for change in solution["additional_changes"]:
            print(
                f"  {change['session_id']}: "
                f"time {change['old_day']} {change['old_time']} "
                f"-> {change['new_day']} {change['new_time']} "
                f"(changed={change['time_changed']}), "
                f"room {change['old_room_id']} "
                f"-> {change['new_room_id']} "
                f"(changed={change['room_changed']})"
            )
        _add_no_good_constraint(
            model,
            solution_number=solution_index + 1,
            all_sessions=all_sessions,
            solver=solver,
            start_vars=start_vars,
            room_vars=room_vars,
        )

    if not solutions:
        return {
            "status": "infeasible",
            "reason": (
                "No feasible alternative was found at the minimum "
                "perturbation count."
            ),
            "minimum_perturbations": minimum_perturbations,
            "solution_count": 0,
            "solutions": [],
        }

    print("\n==========================================")
    print("PERTURBATION ALTERNATIVES")
    print("==========================================")
    print("Target session:", target_session.id)
    print("Minimum perturbations:", minimum_perturbations)
    print("Solutions returned:", len(solutions))

    for solution in solutions:
        print(
            f"Solution {solution['rank']}: "
            f"score={solution['objective_score']}, "
            f"perturbations={solution['perturbation_count']}, "
            f"breakdown={solution['objective_breakdown']}"
        )
        print("IMPACT:", solution["impact"])
    print("==========================================\n")

    return {
        "status": "feasible",
        "reason": None,
        "minimum_perturbations": minimum_perturbations,
        "solution_count": len(solutions),
        "solutions": solutions,
    }
