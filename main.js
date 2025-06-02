// main.js

document.addEventListener('DOMContentLoaded', () => {
  // —— 同时用 Promise.all 读取两个 CSV —— 
  // 1) diabetes_with_HbA1c.csv : 包含 Age, Sex, HbA1c, Diabetes_012 等，
  //    用来画 “HbA1c by Age Group & Gender”。
  // 2) diabetes_prediction_dataset.csv : 包含 hypertension, heart_disease,
  //    smoking_history, bmi, HbA1c_level, diabetes 等，
  //    用来画 其他三个可视化（Population‐Level Distribution、Threshold vs. Proportion、Scatter）。

  Promise.all([
    d3.csv('data/diabetes_with_HbA1c.csv', d => ({
      age:      +d.Age,                               // 原始 CSV 中列名为 "Age"
      gender:   d.Sex,                                // 原始 CSV 中列名为 "Sex"
      hbA1c:    +d.HbA1c,                             // 原始 CSV 中列名为 "HbA1c"
      diabetes: (+d.Diabetes_012 === 2 ? 1 : 0)       // “Diabetes_012” 中 2 表示糖尿病
    })),
    d3.csv('data/diabetes_prediction_dataset.csv', d => ({
      hypertension:  +d.hypertension,                // 0/1
      heart_disease: +d.heart_disease,               // 0/1
      smoking_history: d.smoking_history.trim(),     // 字符串
      bmi:           +d.bmi,                         // 数值
      hbA1c:         +d.HbA1c_level,                 // 数值，对应列 "HbA1c_level"
      diabetes:      +d.diabetes                     // 0/1
    }))
  ])
  .then(([dataWithHb, dataPred]) => {
    // —— 在 dataPred 每条记录上添加 high_bmi, smoker, comboKey —— 
    dataPred.forEach(d => {
      d.high_bmi = d.bmi >= 25 ? 1 : 0;
      const sh = d.smoking_history.trim().toLowerCase();
      d.smoker = (sh === 'never' || sh === 'no') ? 0 : 1;
      d.comboKey = `${d.hypertension}-${d.heart_disease}-${d.smoker}-${d.high_bmi}`;
    });

    // —— 1) 用 dataPred 画 Population‐Level HbA1c Distribution —— 
    drawHistogram(dataPred);

    // —— 2) 用 dataWithHb 画 HbA1c by Age Group & Gender （小提琴图 + 箱线图）—— 
    drawAgeViolinGenderBox(dataWithHb);

    // —— 3) 用 dataPred 画 HbA1c Threshold vs. Diabetes Proportion —— 
    drawRiskCurve(dataPred);

    // —— 4) 用 dataPred 画 “BMI vs. HbA1c” 多重风险因子散点图 —— 
    drawComboScatter(dataPred);
  })
  .catch(err => {
    console.error('读取 CSV 出错：', err);
  });

  // 初始化轮播（Carousel）
  const slides = document.querySelectorAll('.carousel .slide');
  let currentIndex = 0;
  const slideCount = slides.length;
  const intervalTime = 3000; // 每隔 3000ms（3 秒）切换一张
  if (slideCount > 1) {
    setInterval(() => {
      slides[currentIndex].classList.remove('active');
      currentIndex = (currentIndex + 1) % slideCount;
      slides[currentIndex].classList.add('active');
    }, intervalTime);
  }
});


/* =========================================================================
   1. 人群 HbA1c 分布 —— 动态直方图（使用 dataPred）
   ========================================================================= */
function drawHistogram(data) {
  const margin = { top: 20, right: 30, bottom: 30, left: 40 };
  const width = 800 - margin.left - margin.right;
  const height = 350 - margin.top - margin.bottom;

  const svg = d3.select('#histogram')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // 各分类数据（基于 data.hhA1c）
  const dataAll   = data;
  const dataNormal= data.filter(d => d.hbA1c < 5.7);
  const dataPre   = data.filter(d => d.hbA1c >= 5.7 && d.hbA1c < 6.5);
  const dataDia   = data.filter(d => d.hbA1c >= 6.5);

  const xDomain = [
    d3.min(dataAll, d => d.hbA1c) - 0.5,
    d3.max(dataAll, d => d.hbA1c) + 0.5
  ];
  const x = d3.scaleLinear()
    .domain(xDomain)
    .range([0, width]);

  const histogramGen = d3.histogram()
    .value(d => d.hbA1c)
    .domain(x.domain())
    .thresholds(x.ticks(30));

  const binsAll = histogramGen(dataAll);
  const binsNor = histogramGen(dataNormal);
  const binsPre = histogramGen(dataPre);
  const binsDia = histogramGen(dataDia);

  let currentBins = binsAll;

  const y = d3.scaleLinear()
    .domain([0, d3.max(binsAll, d => d.length)])
    .range([height, 0]);

  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x));

  const yAxis = svg.append('g')
    .call(d3.axisLeft(y));

  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip');

  const rects = svg.selectAll('rect')
    .data(currentBins)
    .enter()
    .append('rect')
    .attr('x', d => x(d.x0) + 1)
    .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 1))
    .attr('y', height)
    .attr('height', 0)
    .attr('fill', '#69b3a2');

  rects
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

  rects.transition()
    .duration(1200)
    .attr('y', d => y(d.length))
    .attr('height', d => height - y(d.length));

  const categories = [
    { name: 'all',        bins: binsAll },
    { name: 'normal',     bins: binsNor },
    { name: 'prediabetes',bins: binsPre },
    { name: 'diabetes',   bins: binsDia }
  ];
  let idx = 0;

  d3.interval(() => {
    idx = (idx + 1) % categories.length;
    updateHistogram(categories[idx].bins);
  }, 2500);

  function updateHistogram(nextBins) {
    y.domain([0, d3.max(nextBins, d => d.length)]).nice();
    yAxis.transition().duration(800).call(d3.axisLeft(y));

    svg.selectAll('rect')
      .data(nextBins)
      .transition()
      .duration(800)
      .attr('y', d => y(d.length))
      .attr('height', d => height - y(d.length));
  }
}


/* =========================================================================
   2. 年龄段 + 性别 分析 —— 小提琴图 & 箱线图（使用 dataWithHb）
   ========================================================================= */
function drawAgeViolinGenderBox(data) {
  // 过滤出需要的四个年龄组（0–20, 20–40, 40–60, 60–80）
  const ageBins = ['0–20', '20–40', '40–60', '60–80'];
  const ageGrouped = {};
  ageBins.forEach(bin => (ageGrouped[bin] = []));
  data.forEach(d => {
    if      (d.age <= 20) ageGrouped['0–20'].push(d.hbA1c);
    else if (d.age <= 40) ageGrouped['20–40'].push(d.hbA1c);
    else if (d.age <= 60) ageGrouped['40–60'].push(d.hbA1c);
    else if (d.age <= 80) ageGrouped['60–80'].push(d.hbA1c);
  });

  const genderBins = ['Male', 'Female'];
  const genderGrouped = { 'Male': [], 'Female': [] };
  data.forEach(d => {
    if (genderGrouped[d.gender] !== undefined) {
      genderGrouped[d.gender].push(d.hbA1c);
    }
  });

  // —— 绘制小提琴图（Age Violin）—— 
  {
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const svg = d3.select('#violinPlot')
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .domain(ageBins)
      .range([0, width])
      .padding(0.4);

    const allHbA1c = data.map(d => d.hbA1c);
    const y = d3.scaleLinear()
      .domain([d3.min(allHbA1c) - 0.2, d3.max(allHbA1c) + 0.2])
      .range([height, 0]);

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x));
    svg.append('g').call(d3.axisLeft(y));

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 5)
      .attr('text-anchor', 'middle')
      .text('Age Group');
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -margin.left + 15)
      .attr('text-anchor', 'middle')
      .text('HbA1c (%)');

    function kernelDensityEstimator(kernel, X) {
      return function(V) {
        return X.map(x => [x, d3.mean(V, v => kernel(x - v))]);
      };
    }
    function kernelEpanechnikov(k) {
      return function(v) {
        v /= k;
        return Math.abs(v) <= 1 ? 0.75 * (1 - v * v) / k : 0;
      };
    }

    const xTicks = d3.range(d3.min(allHbA1c), d3.max(allHbA1c) + 0.1, 0.1);
    const allDensities = [];
    ageBins.forEach(bin => {
      const values = ageGrouped[bin];
      if (values.length === 0) {
        allDensities.push({ bin, density: [] });
      } else {
        const kde = kernelDensityEstimator(kernelEpanechnikov(0.4), xTicks);
        const density = kde(values);
        allDensities.push({ bin, density });
      }
    });

    const maxDensity = d3.max(allDensities, d => d3.max(d.density, dd => dd[1]) || 0);
    const xNum = d3.scaleLinear()
      .domain([0, maxDensity])
      .range([0, x.bandwidth() / 2]);

    allDensities.forEach(group => {
      const center = x(group.bin) + x.bandwidth() / 2;
      const grp = svg.append('g');

      grp.append('path')
        .datum(group.density)
        .attr('d', d3.area()
          .x0(d => center + xNum(d[1]))
          .x1(() => center)
          .y(d => y(d[0]))
          .curve(d3.curveCatmullRom))
        .attr('fill', '#69b3a2')
        .attr('stroke', '#2a7f65')
        .attr('stroke-width', 1)
        .attr('opacity', 0.6);

      grp.append('path')
        .datum(group.density)
        .attr('d', d3.area()
          .x0(d => center - xNum(d[1]))
          .x1(() => center)
          .y(d => y(d[0]))
          .curve(d3.curveCatmullRom))
        .attr('fill', '#69b3a2')
        .attr('stroke', '#2a7f65')
        .attr('stroke-width', 1)
        .attr('opacity', 0.6);
    });
  }

  // —— 绘制性别箱线图（Gender Box）—— 
  {
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const svg = d3.select('#genderBoxPlot')
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .domain(genderBins)
      .range([0, width])
      .padding(0.4);

    const allHbA1c = data.map(d => d.hbA1c);
    const y = d3.scaleLinear()
      .domain([d3.min(allHbA1c) - 0.2, d3.max(allHbA1c) + 0.2])
      .range([height, 0]);

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x));
    svg.append('g').call(d3.axisLeft(y));

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 5)
      .attr('text-anchor', 'middle')
      .text('Gender');
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -margin.left + 15)
      .attr('text-anchor', 'middle')
      .text('HbA1c (%)');

    const boxData = [];
    genderBins.forEach(gen => {
      const values = genderGrouped[gen].sort(d3.ascending);
      const q1 = d3.quantile(values, 0.25);
      const median = d3.quantile(values, 0.5);
      const q3 = d3.quantile(values, 0.75);
      const iqr = q3 - q1;
      const lowerWhisker = Math.max(d3.min(values), q1 - 1.5 * iqr);
      const upperWhisker = Math.min(d3.max(values), q3 + 1.5 * iqr);
      boxData.push({ gender: gen, q1, median, q3, lowerWhisker, upperWhisker });
    });

    const boxWidth = x.bandwidth() * 0.5;
    boxData.forEach(d => {
      const cx = x(d.gender) + x.bandwidth() / 2;

      svg.append('rect')
        .attr('x', cx - boxWidth / 2)
        .attr('y', y(d.q3))
        .attr('width', boxWidth)
        .attr('height', y(d.q1) - y(d.q3))
        .attr('fill', '#ff7f0e')
        .attr('opacity', 0.6)
        .attr('stroke', '#cc6600')
        .attr('stroke-width', 1);

      svg.append('line')
        .attr('x1', cx - boxWidth / 2)
        .attr('x2', cx + boxWidth / 2)
        .attr('y1', y(d.median))
        .attr('y2', y(d.median))
        .attr('stroke', '#cc6600')
        .attr('stroke-width', 2);

      svg.append('line')
        .attr('x1', cx)
        .attr('x2', cx)
        .attr('y1', y(d.upperWhisker))
        .attr('y2', y(d.q3))
        .attr('stroke', '#cc6600')
        .attr('stroke-width', 1);
      svg.append('line')
        .attr('x1', cx)
        .attr('x2', cx)
        .attr('y1', y(d.q1))
        .attr('y2', y(d.lowerWhisker))
        .attr('stroke', '#cc6600')
        .attr('stroke-width', 1);

      svg.append('line')
        .attr('x1', cx - boxWidth / 4)
        .attr('x2', cx + boxWidth / 4)
        .attr('y1', y(d.upperWhisker))
        .attr('y2', y(d.upperWhisker))
        .attr('stroke', '#cc6600')
        .attr('stroke-width', 1);
      svg.append('line')
        .attr('x1', cx - boxWidth / 4)
        .attr('x2', cx + boxWidth / 4)
        .attr('y1', y(d.lowerWhisker))
        .attr('y2', y(d.lowerWhisker))
        .attr('stroke', '#cc6600')
        .attr('stroke-width', 1);
    });
  }
}


/* =========================================================================
   3. HbA1c Threshold vs. Diabetes Proportion —— 滑块 + 折线图 & 活动圆点（使用 dataPred）
   ========================================================================= */
function drawRiskCurve(data) {
  const allHbValues = data.map(d => d.hbA1c);
  const minHb = d3.min(allHbValues);
  const maxHb = d3.max(allHbValues);

  const hbSlider = d3.select('#hbSlider')
    .attr('min', minHb.toFixed(1))
    .attr('max', maxHb.toFixed(1))
    .attr('value', minHb.toFixed(1));

  d3.select('#thresholdValue').text(minHb.toFixed(1));

  const thresholds = d3.range(minHb, maxHb + 0.0001, 0.1).map(d => +d.toFixed(1));
  const proportionData = thresholds.map(thr => {
    const subset = data.filter(d => d.hbA1c >= thr);
    if (!subset.length) return { threshold: thr, prop: 0 };
    const countDi = subset.filter(d => d.diabetes === 1).length;
    return { threshold: thr, prop: countDi / subset.length };
  });

  const margin = { top: 20, right: 30, bottom: 40, left: 60 };
  const svgWidth = 500;
  const svgHeight = 350;
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  d3.select('#riskBar').selectAll('*').remove();

  const svg = d3.select('#riskBar')
    .append('svg')
    .attr('width', svgWidth)
    .attr('height', svgHeight)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear()
    .domain([minHb, maxHb])
    .range([0, chartWidth]);

  const yScale = d3.scaleLinear()
    .domain([0, 1])
    .range([chartHeight, 0]);

  svg.append('g')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale).ticks(6));
  svg.append('g')
    .call(d3.axisLeft(yScale).tickFormat(d3.format('.0%')).ticks(5));

  svg.append('text')
    .attr('x', chartWidth / 2)
    .attr('y', chartHeight + margin.bottom - 5)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .text('HbA1c Threshold');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -chartHeight / 2)
    .attr('y', -margin.left + 15)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .text('Proportion of Diabetes');

  const line = d3.line()
    .x(d => xScale(d.threshold))
    .y(d => yScale(d.prop))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(proportionData)
    .attr('fill', 'none')
    .attr('stroke', '#d62728')
    .attr('stroke-width', 2)
    .attr('d', line);

  const activePoint = svg.append('circle')
    .attr('cx', xScale(minHb))
    .attr('cy', yScale(proportionData[0].prop))
    .attr('r', 6)
    .attr('fill', '#ff7f0e')
    .attr('stroke', '#cc6600')
    .attr('stroke-width', 1.5);

  const percentText = svg.append('text')
    .attr('x', xScale(minHb))
    .attr('y', yScale(proportionData[0].prop) - 10)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .attr('fill', '#333')
    .text((proportionData[0].prop * 100).toFixed(1) + '%');

  function updateActivePoint(thr) {
    const t = +thr.toFixed(1);
    const idx = proportionData.findIndex(d => d.threshold === t);
    if (idx < 0) return;
    const yValue = proportionData[idx].prop;
    const xPos = xScale(t);
    const yPos = yScale(yValue);

    activePoint.transition().duration(200)
      .attr('cx', xPos)
      .attr('cy', yPos);

    percentText.transition().duration(200)
      .attr('x', xPos)
      .attr('y', yPos - 10)
      .text((yValue * 100).toFixed(1) + '%');
  }

  updateActivePoint(minHb);

  hbSlider.on('input', function() {
    const curVal = +this.value;
    d3.select('#thresholdValue').text(curVal.toFixed(1));
    updateActivePoint(curVal);
  });
}


/* =========================================================================
   5. BMI vs. HbA1c Scatter Plot —— 多重风险因子组合着色（仅前 2000 条，使用 dataPred）
   ========================================================================= */
function drawComboScatter(data) {
  const plotData = data.slice(0, 2000);

  d3.select('#scatterPlot').selectAll('*').remove();
  d3.selectAll('.tooltip').remove();

  const margin = { top: 40, right: 180, bottom: 60, left: 60 };
  const container = document.getElementById('scatterPlot');
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  const width = containerWidth - margin.left - margin.right;
  const height = containerHeight - margin.top - margin.bottom;

  const svg = d3.select('#scatterPlot')
    .append('svg')
    .attr('width', containerWidth)
    .attr('height', containerHeight)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const xMin = d3.min(plotData, d => d.bmi) - 1;
  const xMax = d3.max(plotData, d => d.bmi) + 1;
  const xScale = d3.scaleLinear()
    .domain([xMin, xMax])
    .range([0, width]);

  const yMin = d3.min(plotData, d => d.hbA1c) - 0.2;
  const yMax = d3.max(plotData, d => d.hbA1c) + 0.2;
  const yScale = d3.scaleLinear()
    .domain([yMin, yMax])
    .range([height, 0]);

  svg.append('g')
    .attr('transform', `translate(0, ${height})`)
    .call(d3.axisBottom(xScale).ticks(8));
  svg.append('g')
    .call(d3.axisLeft(yScale).ticks(8));

  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height + 40)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .text('BMI');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -40)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .text('HbA1c (%)');

  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip');

  const uniqueCombos = Array.from(new Set(plotData.map(d => d.comboKey)));
  const colorScale = d3.scaleOrdinal()
    .domain(uniqueCombos)
    .range(uniqueCombos.map((_, i) => d3.interpolateRainbow(i / (uniqueCombos.length - 1))));

  svg.selectAll('.dot')
    .data(plotData)
    .enter()
    .append('circle')
    .attr('class', 'dot')
    .attr('cx', d => xScale(d.bmi))
    .attr('cy', d => yScale(d.hbA1c))
    .attr('r', 4)
    .attr('fill', d => colorScale(d.comboKey))
    .attr('opacity', 0.75)
    .on('mouseover', function(event, d) {
      d3.select(this)
        .attr('r', 6)
        .attr('stroke', '#333')
        .attr('stroke-width', 1);

      const textHtml = `
        <strong>Hypertension:</strong> ${d.hypertension === 1 ? 'Yes' : 'No'}<br>
        <strong>Heart Disease:</strong> ${d.heart_disease === 1 ? 'Yes' : 'No'}<br>
        <strong>Smoking:</strong> ${d.smoker === 1 ? 'Yes' : 'No'}<br>
        <strong>High BMI (≥25):</strong> ${d.high_bmi === 1 ? 'Yes' : 'No'}<br>
        <strong>BMI:</strong> ${d.bmi.toFixed(1)}<br>
        <strong>HbA1c:</strong> ${d.hbA1c.toFixed(1)}%
      `;
      tooltip.html(textHtml)
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 28) + 'px')
        .style('opacity', 1);
    })
    .on('mouseout', function() {
      d3.select(this)
        .attr('r', 4)
        .attr('stroke', 'none');
      tooltip.style('opacity', 0);
    });

  const legend = svg.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${width + 20}, 0)`);

  uniqueCombos.forEach((key, i) => {
    const row = legend.append('g')
      .attr('transform', `translate(0, ${i * 20})`);

    row.append('rect')
      .attr('width', 14)
      .attr('height', 14)
      .attr('fill', colorScale(key))
      .attr('stroke', '#555')
      .attr('stroke-width', 0.5);

    const parts = key.split('-').map(Number);
    const labelText =
      `HT:${parts[0] === 1 ? 'Y' : 'N'}, ` +
      `HD:${parts[1] === 1 ? 'Y' : 'N'}, ` +
      `SM:${parts[2] === 1 ? 'Y' : 'N'}, ` +
      `HB:${parts[3] === 1 ? 'Y' : 'N'}`;

    row.append('text')
      .attr('x', 20)
      .attr('y', 12)
      .attr('font-size', '12px')
      .text(labelText);
  });
}
