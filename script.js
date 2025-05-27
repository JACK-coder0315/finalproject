// Configuration
const csvFile = 'project3_w_hba1c.csv';   // Path to your CSV file
const hba1cThresholds = { low: 5.7, medium: 6.5 };

// Load and process data
d3.csv(csvFile, d => ({
  subject: d.subject_id,
  hba1c:   +d.hba1c,
  food:    d.food_type,
  time:    +d.time,
  glucose: +d.glucose
})).then(rawData => {
  // Group by subject and food to compute baseline (time=0) and peak glucose
  const groupedData = d3.group(rawData, d => d.subject, d => d.food);
  const records = [];

  for (const [subject, foods] of groupedData) {
    // Determine HbA1c category for this subject
    const hba1cValue = foods.values().next().value[0].hba1c;
    const category = hba1cValue < hba1cThresholds.low
      ? 'low'
      : (hba1cValue < hba1cThresholds.medium ? 'medium' : 'high');

    // For each food, find baseline and peak
    for (const [food, entries] of foods) {
      const baseline = entries.find(d => d.time === 0)?.glucose;
      const peak     = d3.max(entries, d => d.glucose);
      if (baseline != null) {
        records.push({ subject, food, delta: peak - baseline, category });
      }
    }
  }

  // Populate dropdown menu with unique food types
  const foodTypes = Array.from(new Set(records.map(d => d.food)));
  const select = d3.select('#food-select')
                   .selectAll('option')
                   .data(foodTypes)
                   .join('option')
                     .attr('value', d => d)
                     .text(d => d);

  select.on('change', drawPlot);
  select.property('value', foodTypes[0]);

  // Set up SVG canvas and axes
  const svg = d3.select('#viz');
  const margin = { top: 30, right: 20, bottom: 40, left: 50 };
  const width  = +svg.attr('width')  - margin.left - margin.right;
  const height = +svg.attr('height') - margin.top  - margin.bottom;
  const g = svg.append('g')
               .attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scalePoint()
                   .domain(['low', 'medium', 'high'])
                   .range([0, width])
                   .padding(0.5);

  const yScale = d3.scaleLinear()
                   .domain([0, d3.max(records, d => d.delta)]).nice()
                   .range([height, 0]);

  g.append('g')
   .attr('transform', `translate(0,${height})`)
   .call(d3.axisBottom(xScale));

  g.append('g')
   .call(d3.axisLeft(yScale));

  // Draw boxplots for the selected food
  function drawPlot() {
    const selectedFood = select.property('value');
    const filtered     = records.filter(d => d.food === selectedFood);
    const byCategory   = d3.group(filtered, d => d.category);

    // Remove existing plots
    g.selectAll('.boxplot').remove();

    // For each HbA1c category, compute quartiles and whiskers
    byCategory.forEach((values, category) => {
      const deltas = values.map(d => d.delta).sort(d3.ascending);
      const q1     = d3.quantile(deltas, 0.25);
      const median = d3.quantile(deltas, 0.5);
      const q3     = d3.quantile(deltas, 0.75);
      const iqr    = q3 - q1;
      const min    = Math.max(d3.min(deltas), q1 - 1.5 * iqr);
      const max    = Math.min(d3.max(deltas), q3 + 1.5 * iqr);
      const cx     = xScale(category);

      // Draw the box
      g.append('rect')
       .attr('class', 'boxplot')
       .attr('x', cx - 15)
       .attr('y', yScale(q3))
       .attr('width', 30)
       .attr('height', yScale(q1) - yScale(q3));

      // Draw the median line
      g.append('line')
       .attr('class', 'boxplot median')
       .attr('x1', cx - 15)
       .attr('x2', cx + 15)
       .attr('y1', yScale(median))
       .attr('y2', yScale(median));

      // Draw whiskers
      // Upper whisker
      g.append('line')
       .attr('class', 'boxplot median')
       .attr('x1', cx)
       .attr('x2', cx)
       .attr('y1', yScale(max))
       .attr('y2', yScale(q3));
      g.append('line')
       .attr('class', 'boxplot median')
       .attr('x1', cx - 10)
       .attr('x2', cx + 10)
       .attr('y1', yScale(max))
       .attr('y2', yScale(max));

      // Lower whisker
      g.append('line')
       .attr('class', 'boxplot median')
       .attr('x1', cx)
       .attr('x2', cx)
       .attr('y1', yScale(min))
       .attr('y2', yScale(q1));
      g.append('line')
       .attr('class', 'boxplot median')
       .attr('x1', cx - 10)
       .attr('x2', cx + 10)
       .attr('y1', yScale(min))
       .attr('y2', yScale(min));
    });
  }

  // Initial rendering
  drawPlot();
})
.catch(error => console.error('Error loading or processing CSV:', error));
