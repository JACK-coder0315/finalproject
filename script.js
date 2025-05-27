// 配置：CSV 路径 & HbA1c 阈值
const csvFile = 'project3_w_hba1c.csv';
const hba1cThresholds = { low: 5.7, medium: 6.5 };

d3.csv(csvFile, d => ({
  subject: d.ID,                 // CSV 里的“ID”列
  hba1c:   +d['HbA1c'],          // “HbA1c”列
  food:    d.logged_food,        // “logged_food”列
  delta:   +d.grow_in_glu        // 餐后血糖增量 “grow_in_glu”列
}))
.then(rawData => {
  // 1. 分组计算（此时不用再算 peak–baseline，CSV 已给 delta）
  const records = rawData.map(d => ({
    subject: d.subject,
    food:    d.food,
    delta:   d.delta,
    category: d.hba1c < hba1cThresholds.low
             ? 'low'
             : (d.hba1c < hba1cThresholds.medium ? 'medium' : 'high')
  }));

  // 2. 构建下拉菜单
  const foodTypes = Array.from(new Set(records.map(d => d.food)));
  if (foodTypes.length === 0) {
    throw new Error('No food types found – check CSV data and path.');
  }
  const dropdown = d3.select('#food-select');
  dropdown.selectAll('option')
    .data(foodTypes)
    .join('option')
      .attr('value', d => d)
      .text(d => d);
  dropdown.on('change', drawPlot);
  dropdown.property('value', foodTypes[0]);

  // 3. 画布 & 坐标轴
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

  // 4. 绘制箱线图函数
  function drawPlot() {
    const selectedFood = dropdown.property('value');
    const subset       = records.filter(d => d.food === selectedFood);
    const byCategory   = d3.group(subset, d => d.category);

    // 清除旧图
    g.selectAll('.boxplot').remove();

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

  // 初始渲染
  drawPlot();
})
.catch(err => {
  console.error('Error loading or processing CSV:', err);
  alert('Failed to load CSV – check console for details.');
});
