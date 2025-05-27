// script.js

// —— 配置 ——
// CSV 文件名
const csvFile = 'project3_w_hba1c.csv';

// 要展示的特征列表
const features = [
  { key: 'rise_rate',     label: 'Rise Rate (mg/dL·h⁻¹)' },
  { key: 'carb_density',  label: 'Carb Density (g/kcal)' },
  { key: 'sugar_density', label: 'Sugar Density (g/kcal)' },
  { key: 'fiber_ratio',   label: 'Fiber Ratio' },
  { key: 'protein_ratio', label: 'Protein Ratio (g/kcal)' },
  { key: 'fat_ratio',     label: 'Fat Ratio (g/kcal)' }
];

d3.csv(csvFile, d => ({
  grow_in_glu:   +d.grow_in_glu,
  calorie:       +d.calorie,
  total_carb:    +d.total_carb,
  dietary_fiber: +d.dietary_fiber,
  sugar:         +d.sugar,
  protein:       +d.protein,
  total_fat:     +d.total_fat,
  hba1c:         +d.HbA1c
}))
.then(raw => {
  // 1. 过滤无效行
  const data = raw.filter(d => !isNaN(d.grow_in_glu) && d.grow_in_glu > 0);

  // 2. 先按 grow_in_glu>0 保留后，取所有 hba1c 排序，算分位阈值
  const sortedH = data.map(d => d.hba1c).sort(d3.ascending);
  const q1 = d3.quantile(sortedH, 1/3);
  const q2 = d3.quantile(sortedH, 2/3);
  console.log(`动态 HbA1c 阈值： low<${q1.toFixed(2)}, medium<${q2.toFixed(2)}, high≥${q2.toFixed(2)}`);

  // 3. 计算衍生特征 & 根据动态阈值打 hba1c_cat
  data.forEach(d => {
    d.rise_rate     = d.grow_in_glu / 2;  // 固定用2小时
    d.carb_density  = d.total_carb    / d.calorie;
    d.sugar_density = d.sugar         / d.calorie;
    d.fiber_ratio   = d.total_carb > 0
                       ? d.dietary_fiber / d.total_carb
                       : 0;
    d.protein_ratio = d.protein       / d.calorie;
    d.fat_ratio     = d.total_fat     / d.calorie;

    // 动态分档
    if (d.hba1c < q1)            d.hba1c_cat = 'low';
    else if (d.hba1c < q2)       d.hba1c_cat = 'medium';
    else                         d.hba1c_cat = 'high';
  });

  // 4. 下拉菜单
  const select = d3.select('#feature-select');
  select.selectAll('option')
    .data(features)
    .join('option')
      .attr('value', f => f.key)
      .text(f => f.label);
  select.on('change', () => drawBoxplot(select.property('value')));
  select.property('value', features[0].key);

  // 5. 画布和坐标轴
  const svg = d3.select('#chart'),
        margin = { top: 30, right: 20, bottom: 40, left: 50 },
        W = +svg.attr('width')  - margin.left - margin.right,
        H = +svg.attr('height') - margin.top  - margin.bottom,
        g = svg.append('g')
               .attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scalePoint()
                   .domain(['low','medium','high'])
                   .range([0, W])
                   .padding(0.5);

  const yScale = d3.scaleLinear().range([H, 0]);
  const yAxisG = g.append('g');

  // x 轴
  g.append('g')
   .attr('transform', `translate(0,${H})`)
   .call(d3.axisBottom(xScale));

  // 6. 箱线图绘制
  function drawBoxplot(featureKey) {
    // 更新 y 轴
    const maxVal = d3.max(data, d => d[featureKey]);
    yScale.domain([0, maxVal]).nice();
    yAxisG.call(d3.axisLeft(yScale));

    // 按类别分组
    const grouped = d3.group(data, d => d.hba1c_cat);
    g.selectAll('.boxplot').remove();

    for (const [cat, arr] of grouped) {
      const vals  = arr.map(d=>d[featureKey]).sort(d3.ascending);
      const qq1   = d3.quantile(vals, 0.25),
            mid   = d3.quantile(vals, 0.5),
            qq3   = d3.quantile(vals, 0.75),
            iqr   = qq3 - qq1,
            mn    = Math.max(d3.min(vals), qq1 - 1.5*iqr),
            mx    = Math.min(d3.max(vals), qq3 + 1.5*iqr),
            cx    = xScale(cat);

      // 箱体
      g.append('rect')
       .attr('class','boxplot')
       .attr('x', cx - 15)
       .attr('y', yScale(qq3))
       .attr('width', 30)
       .attr('height', Math.max(0, yScale(qq1) - yScale(qq3)));

      // 中位线
      g.append('line')
       .attr('class','boxplot median')
       .attr('x1', cx-15).attr('x2', cx+15)
       .attr('y1', yScale(mid)).attr('y2', yScale(mid));

      // 须
      [[mx, qq3], [mn, qq1]].forEach(([v1, v2])=>{
        g.append('line')
         .attr('class','boxplot median')
         .attr('x1',cx).attr('x2',cx)
         .attr('y1',yScale(v1)).attr('y2',yScale(v2));
        g.append('line')
         .attr('class','boxplot median')
         .attr('x1',cx-10).attr('x2',cx+10)
         .attr('y1',yScale(v1)).attr('y2',yScale(v1));
      });
    }
  }

  // 初次渲染
  drawBoxplot(features[0].key);
})
.catch(err => {
  console.error('CSV load or parse error:', err);
  alert('Load CSV error—see console.');
});
