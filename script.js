// 配置：CSV 路径 & HbA1c 分箱阈值
const csvFile = 'project3_w_hba1c.csv';
const hba1cThresholds = { low: 5.7, medium: 6.5 };

d3.csv(csvFile, d => ({
  subject: d.subject_id,
  hba1c:   +d.hba1c,
  food:    d.food_type,
  time:    +d.time,
  glucose: +d.glucose
}))
.then(rawData => {
  // --- 1. 数据预处理，计算 delta ---
  const grouped = d3.group(rawData, d => d.subject, d => d.food);
  const records = [];

  for (const [subject, foods] of grouped) {
    // 每个 subject 的 HbA1c 值与类别
    const hba1cValue = foods.values().next().value[0].hba1c;
    const category = hba1cValue < hba1cThresholds.low
      ? 'low'
      : (hba1cValue < hba1cThresholds.medium ? 'medium' : 'high');

    // 每种 food 的 baseline (time=0) 与 peak
    for (const [food, entries] of foods) {
      const baseline = entries.find(d => d.time === 0)?.glucose;
      const peak     = d3.max(entries, d => d.glucose);
      if (baseline != null) {
        records.push({
          subject,
          food,
          delta: peak - baseline,
          category
        });
      }
    }
  }

  // --- 2. 构造下拉菜单 ---
  const foodTypes = Array.from(new Set(records.map(d => d.food)));
  if (foodTypes.length === 0) {
    throw new Error('No food types found – check CSV data and path.');
  }

  // 明确拿到 <select> 元素
  const dropdown = d3.select('#food-select');
  dropdown.selectAll('option')
    .data(foodTypes)
    .join('option')
      .attr('value', d => d)
      .text(d => d);

  // 绑定 change 事件 & 默认值
  dropdown.on('change', drawPlot);
  dropdown.property('value', foodTypes[0]);

  // --- 3. 画布和坐标轴设置 ---
  const svg = d3.select('#viz');
  const margin = { top: 30, right: 20, bottom: 40, left: 50 };
  const width  = +svg.attr('width')  - margin.left - margin.right;
  const height = +svg.attr('height') - margin.top  - margin.bottom;
  const g = svg.append('g')
               .attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scalePoint()
                   .domain(['low','medium','high'])
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

  // --- 4. 绘制箱线图函数 ---
  function drawPlot() {
    const selectedFood = dropdown.property('value');
    const subset       = records.filter(d => d.food === selectedFood);
    const byCategory   = d3.group(subset, d => d.category);

    // 先清除旧的图形
    g.selectAll('.boxplot').remove();

    // 对每个类别分别画箱线
    byCategory.forEach((vals, category) => {
      const arr    = vals.map(d => d.delta).sort(d3.ascending);
      const q1     = d3.quantile(arr, 0.25);
      const median = d3.quantile(arr, 0.5);
      const q3     = d3.quantile(arr, 0.75);
      const iqr    = q3 - q1;
      const min    = Math.max(d3.min(arr), q1 - 1.5 * iqr);
      const max    = Math.min(d3.max(arr), q3 + 1.5 * iqr);
      const cx     = xScale(category);

      // 箱体
      g.append('rect')
       .attr('class','boxplot')
       .attr('x', cx - 15)
       .attr('y', yScale(q3))
       .attr('width', 30)
       .attr('height', yScale(q1) - yScale(q3));

      // 中位线
      g.append('line')
       .attr('class','boxplot median')
       .attr('x1', cx - 15).attr('x2', cx + 15)
       .attr('y1', yScale(median)).attr('y2', yScale(median));

      // 上须
      g.append('line')
       .attr('class','boxplot median')
       .attr('x1', cx).attr('x2', cx)
       .attr('y1', yScale(max)).attr('y2', yScale(q3));
      g.append('line')
       .attr('class','boxplot median')
       .attr('x1', cx - 10).attr('x2', cx + 10)
       .attr('y1', yScale(max)).attr('y2', yScale(max));

      // 下须
      g.append('line')
       .attr('class','boxplot median')
       .attr('x1', cx).attr('x2', cx)
       .attr('y1', yScale(min)).attr('y2', yScale(q1));
      g.append('line')
       .attr('class','boxplot median')
       .attr('x1', cx - 10).attr('x2', cx + 10)
       .attr('y1', yScale(min)).attr('y2', yScale(min));
    });
  }

  // 初次渲染
  drawPlot();
})
.catch(err => {
  console.error('Error loading or processing CSV:', err);
  alert('Failed to load CSV. See console for details.');
});
