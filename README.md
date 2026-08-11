## Redesign
the constraints and relaxed constraints thingy
what should happen when i update the relaxation, delete relaxation, mute the constraint

- real ids ints
- error responses
- you do queries in the controller
- you do many queries where they could be 1 query
- you create + modify relaxations with a POST ??
- NO TESTS ?? 
- stress tests 
- does REACT consume this correctly? I dont know
- frontend/src/shared/api/client.ts - is this how its done?
- all css and python files should be better organized (like by stakeholder or component they have to do with)

>we need one more stakeholder and that is room. constraint which goes there is: "A room can have maximum one booking at a time"
So now lets think somethin else:
>Class equipment lets say CS101 has two sessions. We dont separate by day here but by session. However, I would say that for now the constraint shouldnt be further breakable. Eeverything applies to all sessions. 
>Same for Class Capacity
>Cohort's maximum teaching hours per day. So here, each cohort has its own constraint AND for each day separatately. So I'd say for each cohort and day we have a CohortConstraint Eintrag in the DB 
>Lecturer cannot teach more than 1 class at a time: here we split only by lecturer
>Lecturer unavailability:  here we split lecturer (this constraint is breakable btw) 
>here we split only by lecturer:  here we split lecturer and day
>Lecturer shall teach maximum 1 hour per day: here we split lecturer and day

# TODO: find a public or 2 two public repos and see how they handle API responses there
# TODO: what are schemas ?

# TODO: index and defining visual indentity? 