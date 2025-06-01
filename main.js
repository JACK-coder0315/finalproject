// main.js

// 等待 DOM 完成加载后再执行所有可视化逻辑
document.addEventListener('DOMContentLoaded', () => {
  // 1. 读取原始 Kaggle 数据，生成所需数据并绘制前三个可视化
  d3.csv('data/diabetes_prediction_dataset.csv', d => ({
    gender: d.gender,
    age: +d.age,
    hypertension: +d.hypertension,
    heart_disease: +d.heart_disease,
    smoking_history: d.smoking_history,
    bmi: +d.bmi,
    hbA1c: +d.HbA1c_level,
    blood_glucose: +d.blood_glucose_level,
    diabetes: +d.diabetes
  })).then(rawData => {
    // 先给每条记录添加 status 字段，用于第一个直方图
    rawData.forEach(d => {
      if (d.hbA1c < 5.7) d.status = 'normal';
      else if (d.hbA1c < 6.5) d.status = 'prediabetes';
      else d.status = 'diabetes';
    });

    drawHistogram(rawData);
    drawAgeTrend(rawData);
    drawRiskCurve(rawData);
    // 个体纵向进程示例需要额外“同一个人多时点测量”的数据，此处无法从此单次测量集生成
  }).catch(error => {
    console.error('加载 diabetes_prediction_dataset.csv 出错：', error);
  });
});

/* =========================================================================
   1. 人群 HbA1c 分布 —— 直方图
   源数据：rawData，字段包括 hbA1c、status
   ========================================================================= */
function drawHistogram(data) {
  // 画布尺寸及边距
  const margin = { top: 20, right: 30, bottom: 30, left: 40 };
  const width = 800 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  // 创建 SVG
  const svg = d3.select('#histogram')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // x 轴范围：由原始数据 hbA1c 的最小/最大决定，稍微扩展一点
  const hbA1cValues = data.map(d => d.hbA1c);
  const x = d3.scaleLinear()
    .domain([d3.min(hbA1cValues) - 0.5, d3.max(hbA1cValues) + 0.5])
    .nice()
    .range([0, width]);

  // 生成 bins（直方图分块）
  const histogramGen = d3.histogram()
    .value(d => d.hbA1c)
    .domain(x.domain())
    .thresholds(x.ticks(30));

  const bins = histogramGen(data);

  // y 轴：每个 bin 的计数
  const y = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.length)])
    .nice()
    .range([height, 0]);

  // 绘制直方图柱子
  svg.selectAll('rect')
    .data(bins)
    .enter()
    .append('rect')
      .attr('x', d => x(d.x0) + 1)
      .attr('y', d => y(d.length))
      .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 1))
      .attr('height', d => height - y(d.length))
      .attr('fill', '#69b3a2');

  // x 轴
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x));

  // y 轴
  svg.append('g')
    .call(d3.axisLeft(y));

  // x 轴 标签
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height + margin.bottom - 5)
    .attr('text-anchor', 'middle')
    .text('HbA1c (%)');

  // y 轴 标签
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -margin.left + 15)
    .attr('text-anchor', 'middle')
    .text('Count');

  // Tooltip
  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip');

  svg.selectAll('rect')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('fill', '#ff7f0e');
      tooltip
        .html(`Range: ${d.x0.toFixed(1)}–${d.x1.toFixed(1)}<br>Count: ${d.length}`)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 30) + 'px')
        .style('opacity', 1);
    })
    .on('mouseout', function() {
      d3.select(this).attr('fill', '#69b3a2');
      tooltip.style('opacity', 0);
    });
}

/* =========================================================================
   2. HbA1c 随年龄变化趋势 —— 折线 + 滑块高亮
   源数据：data，字段包括 age、hbA1c
   ========================================================================= */
function drawAgeTrend(data) {
  // 把数据按整数年龄分组，计算平均值与标准差
  const ageGroups = d3.rollups(
    data,
    v => {
      const arr = v.map(d => d.hbA1c);
      return {
        mean: d3.mean(arr),
        std: d3.deviation(arr)
      };
    },
    d => Math.floor(d.age)
  );
  // 转换成对象数组
  const ageTrend = ageGroups.map(([age, stats]) => ({
    age: age,
    mean: stats.mean,
    std: stats.std || 0
  })).sort((a, b) => a.age - b.age);

  // 画布尺寸及边距
  const margin = { top: 20, right: 60, bottom: 40, left: 50 };
  const width = 800 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  // 创建 SVG
  const svg = d3.select('#lineChart')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // x 轴：年龄范围
  const x = d3.scaleLinear()
    .domain(d3.extent(ageTrend, d => d.age))
    .range([0, width]);

  // y 轴：平均 HbA1c 范围（扩展一点，包含误差带）
  const y = d3.scaleLinear()
    .domain([
      d3.min(ageTrend, d => d.mean - d.std) - 0.2,
      d3.max(ageTrend, d => d.mean + d.std) + 0.2
    ])
    .range([height, 0]);

  // 绘制折线
  const line = d3.line()
    .x(d => x(d.age))
    .y(d => y(d.mean))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(ageTrend)
    .attr('fill', 'none')
    .attr('stroke', '#ff7f0e')
    .attr('stroke-width', 2)
    .attr('d', line);

  // 绘制误差带（± std）
  const area = d3.area()
    .x(d => x(d.age))
    .y0(d => y(d.mean - d.std))
    .y1(d => y(d.mean + d.std))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(ageTrend)
    .attr('fill', '#ff7f0e')
    .attr('opacity', 0.2)
    .attr('d', area);

  // x 轴
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(7));

  // y 轴
  svg.append('g')
    .call(d3.axisLeft(y));

  // 标签
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height + margin.bottom - 5)
    .attr('text-anchor', 'middle')
    .text('Age (Years)');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -margin.left + 15)
    .attr('text-anchor', 'middle')
    .text('Mean HbA1c (%)');

  // 滑块与高亮点
  const ageSlider = d3.select('#ageSlider')
    .attr('min', d3.min(ageTrend, d => d.age))
    .attr('max', d3.max(ageTrend, d => d.age))
    .attr('value', d3.min(ageTrend, d => d.age));

  const ageValueLabel = d3.select('#ageValue');

  const focusCircle = svg.append('circle')
    .attr('r', 6)
    .attr('fill', 'steelblue')
    .style('opacity', 0);

  function updateAge(chosenAge) {
    const rec = ageTrend.find(d => d.age === +chosenAge);
    if (!rec) return;
    focusCircle
      .attr('cx', x(rec.age))
      .attr('cy', y(rec.mean))
      .style('opacity', 1);
    ageValueLabel.text(chosenAge);
  }

  ageSlider.on('input', function() {
    updateAge(this.value);
  });

  // 初始高亮
  updateAge(d3.min(ageTrend, d => d.age));
}

/* =========================================================================
   3. HbA1c 与糖尿病风险曲线 —— 散点 + 连线 + Tooltip
   源数据：data，字段包括 hbA1c、diabetes
   ========================================================================= */
function drawRiskCurve(data) {
  // 四舍五入到小数点后一位，生成 hbA1c_round 字段
  data.forEach(d => {
    d.hbA1cRound = Math.round(d.hbA1c * 10) / 10;
  });

  // 按 hbA1cRound 分组，计算 diabetes==1 的比例
  const riskGroups = d3.rollups(
    data,
    v => v.filter(d => d.diabetes === 1).length / v.length,
    d => d.hbA1cRound
  );
  const riskData = riskGroups.map(([hb, prob]) => ({
    hbA1c: hb,
    risk_prob: prob
  })).sort((a, b) => a.hbA1c - b.hbA1c);

  // 画布尺寸及边距
  const margin = { top: 20, right: 60, bottom: 40, left: 50 };
  const width = 800 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  // 创建 SVG
  const svg = d3.select('#riskCurve')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // x 轴：hbA1c 值范围
  const x = d3.scaleLinear()
    .domain(d3.extent(riskData, d => d.hbA1c))
    .range([0, width]);

  // y 轴：概率 0–1
  const y = d3.scaleLinear()
    .domain([0, 1])
    .range([height, 0]);

  // 绘制散点
  svg.selectAll('circle')
    .data(riskData)
    .enter()
    .append('circle')
      .attr('cx', d => x(d.hbA1c))
      .attr('cy', d => y(d.risk_prob))
      .attr('r', 4)
      .attr('fill', '#d62728');

  // 绘制连线
  const line = d3.line()
    .x(d => x(d.hbA1c))
    .y(d => y(d.risk_prob))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(riskData)
    .attr('fill', 'none')
    .attr('stroke', '#1f77b4')
    .attr('stroke-width', 2)
    .attr('d', line);

  // x 轴
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x));

  // y 轴
  svg.append('g')
    .call(d3.axisLeft(y).ticks(5));

  // 标签
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height + margin.bottom - 5)
    .attr('text-anchor', 'middle')
    .text('HbA1c (%)');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -margin.left + 15)
    .attr('text-anchor', 'middle')
    .text('Risk Probability');

  // Tooltip
  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip');

  svg.selectAll('circle')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('r', 6).attr('fill', '#ff7f0e');
      tooltip
        .html(`HbA1c: ${d.hbA1c.toFixed(1)}%<br>Risk: ${(d.risk_prob * 100).toFixed(1)}%`)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 30) + 'px')
        .style('opacity', 1);
    })
    .on('mouseout', function() {
      d3.select(this).attr('r', 4).attr('fill', '#d62728');
      tooltip.style('opacity', 0);
    });
}
