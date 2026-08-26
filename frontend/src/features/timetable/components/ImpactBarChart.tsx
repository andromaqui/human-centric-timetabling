import "./ImpactBarChart.css";

type ImpactBarChartProps = {
  impactType: "lunch-break-reduced" | "consecutive-teaching";
  stakeholderType: "lecturer" | "cohort";
};

export function ImpactBarChart({
  impactType,
  stakeholderType,
}: ImpactBarChartProps) {
  const isLunch = impactType === "lunch-break-reduced";

  /*
   * Dummy data for now.
   * Later this will come from historicalStakeholderImpacts.
   */
  const lecturerData = isLunch
    ? [
        { name: "Dr. Maria Chen", value: 185 },
        { name: "Prof. James O'Connor", value: 105 },
        { name: "Dr. Emma Walsh", value: 70 },
        { name: "Prof. Michael Ryan", value: 40 },
      ]
    : [
        { name: "Dr. Maria Chen", value: 750 },
        { name: "Prof. James O'Connor", value: 525 },
        { name: "Dr. Emma Walsh", value: 330 },
        { name: "Prof. Michael Ryan", value: 195 },
      ];

  const cohortData = isLunch
    ? [
        { name: "Computer Science Year 1", value: 220 },
        { name: "Computer Science Year 2", value: 160 },
        { name: "Data Science Year 1", value: 95 },
        { name: "Software Engineering Year 2", value: 55 },
      ]
    : [
        { name: "Computer Science Year 1", value: 620 },
        { name: "Computer Science Year 2", value: 480 },
        { name: "Data Science Year 1", value: 310 },
        { name: "Software Engineering Year 2", value: 180 },
      ];

  /*
   * Choose which stakeholder data to display.
   */
  const data =
    stakeholderType === "lecturer"
      ? lecturerData
      : cohortData;

  /*
   * Largest value determines the width of the other bars.
   */
  const maxValue = Math.max(
    ...data.map((item) => item.value),
  );

  /*
   * Lunch is displayed in minutes.
   *
   * Consecutive teaching is stored in minutes but displayed
   * as hours + minutes.
   */
  function formatValue(value: number) {
    if (isLunch) {
      return `${value} min`;
    }

    const hours = Math.floor(value / 60);
    const minutes = value % 60;

    return minutes === 0
      ? `${hours} h`
      : `${hours} h ${minutes} min`;
  }

  return (
    <section className="impact-bar-chart">
      <div className="impact-bar-chart-header">
        <h2>Accumulated impact</h2>

        <p>
          {isLunch
            ? "Total lunch-break time lost across displayed semesters."
            : "Total teaching time above the daily limit across displayed semesters."}
        </p>
      </div>

      <div className="impact-bar-chart-list">
        {data.map((item) => (
          <div
            key={item.name}
            className="impact-bar-chart-row"
          >
            <span className="impact-bar-chart-name">
              {item.name}
            </span>

            <div className="impact-bar-chart-track">
              <div
                className="impact-bar-chart-fill"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                }}
              />
            </div>

            <strong className="impact-bar-chart-value">
              {formatValue(item.value)}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}