// main.js

// 等待 DOM 完全加载后执行
document.addEventListener('DOMContentLoaded', () => {
  // 读取原始 Kaggle 数据
  d3.csv('data/diabetes_prediction_dataset.csv', d => ({
    gender: d.gender,
    age: +d.age,
    hypertension: +d.hypertension,       // 0 / 1
    heart_disease: +d.heart_disease,     // 0 / 1
    smoking_history: d.smoking_history,  // 字符串
    bmi: +d.bmi,
    hbA1c: +d.HbA1c_level,
    blood_glucose: +d.blood_glucose_level,
    diabetes: +d.diabetes                // 0 / 1
  })).then(rawData => {
    // 为每条记录添加 status（HbA1c 状态）、ageGroup、high_bmi、smoker
    rawData.forEach(d => {
      // HbA1c 状态
      if (d.hbA1c < 5.7) d.status = 'normal';
      else if (d.hbA1c < 6.5) d.status = 'prediabetes';
      else d.status = 'diabetes';

      // 年龄分组：0-20, 20-40, 40-60, 60-80
      if (d.age <= 20) {
        d.ageGroup = '0–20';
      } else if (d.age > 20 && d.age <= 40) {
        d.ageGroup = '20–40';
      } else if (d.age > 40 && d.age <= 60) {
        d.ageGroup = '40–60';
      } else if (d.age > 60 && d.age <= 80) {
        d.ageGroup = '60–80';
      } else {
        d.ageGroup = 'Other';
      }

      // High BMI（二元）：BMI ≥ 25 为高 BMI
      d.high_bmi = d.bmi >= 25 ? 1 : 0;

      // 将 smoking_history 转为二元 smoker 字段
      const sh = d.smoking_history.trim().toLowerCase();
      // "never" 或 "no" 视为 0，其余视为 1
      d.smoker = (sh === 'never' || sh === 'no') ? 0 : 1;
    });

    // 执行原有的可视化
    drawHistogram(rawData);
    drawAgeViolinGenderBox(rawData);
    drawRiskCurve(rawData); 

    // 初始绘制 BMI vs. HbA1c Scatter + Regression，默认因子为 'hypertension'
    drawScatterWithRegression(rawData, 'hypertension');

    // 下拉菜单事件：切换二元因子时，重新绘制散点 + 回归
    d3.select('#factorSelect').on('change', function() {
      const selectedFactor = d3.select(this).property('value');
      drawScatterWithRegression(rawData, selectedFactor);
    });

  }).catch(error => {
    console.error('加载 diabetes_prediction_dataset.csv 出错：', error);
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
   1. 人群 HbA1c 分布 —— 动态直方图
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

  // 各分类数据
  const dataAll = data;
  const dataNormal = data.filter(d => d.status === 'normal');
  const dataPre = data.filter(d => d.status === 'prediabetes');
  const dataDia = data.filter(d => d.status === 'diabetes');

  // x 轴刻度范围
  const xDomain = [
    d3.min(dataAll, d => d.hbA1c) - 0.5,
    d3.max(dataAll, d => d.hbA1c) + 0.5
  ];
  const x = d3.scaleLinear()
    .domain(xDomain)
    .range([0, width]);

  // histogram 生成器
  const histogramGen = d3.histogram()
    .value(d => d.hbA1c)
    .domain(x.domain())
    .thresholds(x.ticks(30));

  const binsAll = histogramGen(dataAll);
  const binsNor = histogramGen(dataNormal);
  const binsPre = histogramGen(dataPre);
  const binsDia = histogramGen(dataDia);

  // 初始使用所有数据的 bins
  let currentBins = binsAll;

  // y 轴 scale
  const y = d3.scaleLinear()
    .domain([0, d3.max(binsAll, d => d.length)])
    .range([height, 0]);

  // 绘制 x 轴
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x));

  // 绘制 y 轴
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y));

  // Tooltip
  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip');

  // 创建初始矩形（柱子）
  const rects = svg.selectAll('rect')
    .data(currentBins)
    .enter()
    .append('rect')
    .attr('x', d => x(d.x0) + 1)
    .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 1))
    .attr('y', height)
    .attr('height', 0)
    .attr('fill', '#69b3a2');

  // 鼠标交互
  rects
    .on('mouseover', function (event, d) {
      d3.select(this).attr('fill', '#ff7f0e');
      tooltip
        .html(`Range: ${d.x0.toFixed(1)}–${d.x1.toFixed(1)}<br>Count: ${d.length}`)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 30) + 'px')
        .style('opacity', 1);
    })
    .on('mouseout', function () {
      d3.select(this).attr('fill', '#69b3a2');
      tooltip.style('opacity', 0);
    });

  // 初始过渡：让柱子“从底部长出”
  rects.transition()
    .duration(1200)
    .attr('y', d => y(d.length))
    .attr('height', d => height - y(d.length));

  // 分类顺序循环：all → normal → prediabetes → diabetes → all
  const categories = [
    { name: 'all', bins: binsAll },
    { name: 'normal', bins: binsNor },
    { name: 'prediabetes', bins: binsPre },
    { name: 'diabetes', bins: binsDia }
  ];
  let idx = 0;

  d3.interval(() => {
    idx = (idx + 1) % categories.length;
    updateHistogram(categories[idx].bins);
  }, 2500);

  // 更新函数：更新 y 轴和柱子高度
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
   2. 年龄段 + 性别 分析 —— 小提琴图 & 箱线图
   ========================================================================= */
function drawAgeViolinGenderBox(data) {
  // 过滤出需要的四个年龄组（0-20, 20-40, 40-60, 60-80）
  const ageBins = ['0–20', '20–40', '40–60', '60–80'];
  // 准备每个年龄段的 HbA1c 数组
  const ageGrouped = {};
  ageBins.forEach(bin => ageGrouped[bin] = []);
  data.forEach(d => {
    if (ageGrouped[d.ageGroup] !== undefined) {
      ageGrouped[d.ageGroup].push(d.hbA1c);
    }
  });

  // 性别分组
  const genderBins = ['Male', 'Female'];
  const genderGrouped = { 'Male': [], 'Female': [] };
  data.forEach(d => {
    if (genderGrouped[d.gender] !== undefined) {
      genderGrouped[d.gender].push(d.hbA1c);
    }
  });

  // 1) 绘制小提琴图（Age Violin Plot）
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

    // x 轴：年龄组
    const x = d3.scaleBand()
      .domain(ageBins)
      .range([0, width])
      .padding(0.4);

    // y 轴：HbA1c 范围
    const allHbA1c = data.map(d => d.hbA1c);
    const y = d3.scaleLinear()
      .domain([d3.min(allHbA1c) - 0.2, d3.max(allHbA1c) + 0.2])
      .range([height, 0]);

    // 绘制坐标轴
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x));
    svg.append('g')
      .call(d3.axisLeft(y));

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

    // Kernel Density Estimator 函数
    function kernelDensityEstimator(kernel, X) {
      return function (V) {
        return X.map(x => [x, d3.mean(V, v => kernel(x - v))]);
      };
    }
    function kernelEpanechnikov(k) {
      return function (v) {
        v /= k;
        return Math.abs(v) <= 1 ? 0.75 * (1 - v * v) / k : 0;
      };
    }

    // 为每个年龄组计算密度
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

    // 找到最大的密度值，用于缩放
    const maxDensity = d3.max(allDensities, d => d3.max(d.density, dd => dd[1]) || 0);

    // 用来绘制小提琴图的水平尺度
    const xNum = d3.scaleLinear()
      .domain([0, maxDensity])
      .range([0, x.bandwidth() / 2]);

    // 绘制每个小提琴
    allDensities.forEach(group => {
      const center = x(group.bin) + x.bandwidth() / 2;
      const grp = svg.append('g');

      // 双边小提琴：先右半部分
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

      // 左半部分
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

  // 2) 绘制性别箱线图（Gender Box Plot），高度与上面相同
  {
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom; // 与小提琴图保持相同高度

    const svg = d3.select('#genderBoxPlot')
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // x 轴：Gender
    const x = d3.scaleBand()
      .domain(genderBins)
      .range([0, width])
      .padding(0.4);

    // y 轴：HbA1c 范围，与上面一致
    const allHbA1c = data.map(d => d.hbA1c);
    const y = d3.scaleLinear()
      .domain([d3.min(allHbA1c) - 0.2, d3.max(allHbA1c) + 0.2])
      .range([height, 0]);

    // 绘制轴
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x));
    svg.append('g')
      .call(d3.axisLeft(y));

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

    // 准备将每个性别组排序并计算箱线图所需的五数概括
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

    // 绘制每个箱线
    const boxWidth = x.bandwidth() * 0.5;
    boxData.forEach(d => {
      const cx = x(d.gender) + x.bandwidth() / 2;

      // 箱体
      svg.append('rect')
        .attr('x', cx - boxWidth / 2)
        .attr('y', y(d.q3))
        .attr('width', boxWidth)
        .attr('height', y(d.q1) - y(d.q3))
        .attr('fill', '#ff7f0e')
        .attr('opacity', 0.6)
        .attr('stroke', '#cc6600')
        .attr('stroke-width', 1);

      // 中位数线
      svg.append('line')
        .attr('x1', cx - boxWidth / 2)
        .attr('x2', cx + boxWidth / 2)
        .attr('y1', y(d.median))
        .attr('y2', y(d.median))
        .attr('stroke', '#cc6600')
        .attr('stroke-width', 2);

      // 须线（上下）
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

      // 须端
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
   3. HbA1c Threshold vs. Diabetes Proportion —— 滑块 + 折线图 & 活动圆点
   ========================================================================= */
function drawRiskCurve(data) {
  // 先获取数据中 HbA1c 的最小、最大值，用于滑块上下限
  const allHbValues = data.map(d => d.hbA1c);
  const minHb = d3.min(allHbValues);
  const maxHb = d3.max(allHbValues);

  // 设置滑块属性
  const hbSlider = d3.select('#hbSlider')
    .attr('min', minHb.toFixed(1))
    .attr('max', maxHb.toFixed(1))
    .attr('value', minHb.toFixed(1));

  d3.select('#thresholdValue').text(minHb.toFixed(1));

  // 生成一系列阈值（0.1 步长）
  const thresholds = d3.range(minHb, maxHb + 0.0001, 0.1).map(d => +d.toFixed(1));

  // 计算每个阈值下的“糖尿病比例”
  const proportionData = thresholds.map(thr => {
    const subset = data.filter(d => d.hbA1c >= thr);
    if (subset.length === 0) {
      return { threshold: thr, prop: 0 };
    }
    const countDi = subset.filter(d => d.diabetes === 1).length;
    return { threshold: thr, prop: countDi / subset.length };
  });

  // 准备 SVG 尺寸
  const margin = { top: 20, right: 30, bottom: 40, left: 60 };
  const svgWidth = 500;
  const svgHeight = 350;
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  // 清空容器
  d3.select('#riskBar').selectAll('*').remove();

  const svg = d3.select('#riskBar')
    .append('svg')
    .attr('width', svgWidth)
    .attr('height', svgHeight)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // x 轴比例尺：阈值 → 像素
  const xScale = d3.scaleLinear()
    .domain([minHb, maxHb])
    .range([0, chartWidth]);

  // y 轴比例尺：比例 0–1 → 像素
  const yScale = d3.scaleLinear()
    .domain([0, 1])
    .range([chartHeight, 0]);

  // 绘制 x 轴
  svg.append('g')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale).ticks(6));

  // 绘制 y 轴
  svg.append('g')
    .call(d3.axisLeft(yScale).tickFormat(d3.format('.0%')).ticks(5));

  // x 轴标签
  svg.append('text')
    .attr('x', chartWidth / 2)
    .attr('y', chartHeight + margin.bottom - 5)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .text('HbA1c Threshold');

  // y 轴标签
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -chartHeight / 2)
    .attr('y', -margin.left + 15)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .text('Proportion of Diabetes');

  // 绘制折线
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

  // 绘制一个初始的“活动圆点”在最小阈值处
  const activePoint = svg.append('circle')
    .attr('cx', xScale(minHb))
    .attr('cy', yScale(proportionData[0].prop))
    .attr('r', 6)
    .attr('fill', '#ff7f0e')
    .attr('stroke', '#cc6600')
    .attr('stroke-width', 1.5);

  // 在圆点旁边显示百分比文本
  const percentText = svg.append('text')
    .attr('x', xScale(minHb))
    .attr('y', yScale(proportionData[0].prop) - 10)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .attr('fill', '#333')
    .text((proportionData[0].prop * 100).toFixed(1) + '%');

  // 定义更新函数：当滑块变化时，移动圆点并更新文本
  function updateActivePoint(thr) {
    // 四舍五入到 1 位小数
    const t = +thr.toFixed(1);
    // 找到对应条目的 index
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

  // 初始绘制
  updateActivePoint(minHb);

  // 监听滑块变化
  hbSlider.on('input', function () {
    const curVal = +this.value;
    d3.select('#thresholdValue').text(curVal.toFixed(1));
    updateActivePoint(curVal);
  });
}


/* =========================================================================
   5. BMI vs. HbA1c 交互式散点 + 回归线
   ========================================================================= */
function drawScatterWithRegression(data, factor) {
  // 清空旧图
  d3.select('#scatterPlot').selectAll('*').remove();

  // SVG 尺寸设置
  const margin = { top: 20, right: 30, bottom: 50, left: 60 };
  const containerWidth = document.getElementById('scatterPlot').clientWidth;
  const containerHeight = document.getElementById('scatterPlot').clientHeight;
  const width = containerWidth - margin.left - margin.right;
  const height = containerHeight - margin.top - margin.bottom;

  // 新建 SVG
  const svg = d3.select('#scatterPlot')
    .append('svg')
    .attr('width', containerWidth)
    .attr('height', containerHeight)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // X 轴：BMI，Y 轴：HbA1c
  const xExtent = d3.extent(data, d => d.bmi);
  const yExtent = d3.extent(data, d => d.hbA1c);

  // 在数据范围两端稍微留点空白
  const xScale = d3.scaleLinear()
    .domain([xExtent[0] - 1, xExtent[1] + 1])
    .range([0, width]);

  const yScale = d3.scaleLinear()
    .domain([yExtent[0] - 0.2, yExtent[1] + 0.2])
    .range([height, 0]);

  // 绘制坐标轴
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(8));

  svg.append('g')
    .call(d3.axisLeft(yScale).ticks(8));

  // 坐标轴标签
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height + margin.bottom - 10)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .text('BMI');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -margin.left + 15)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .text('HbA1c (%)');

  // Tooltip
  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip');

  // 根据 factor 分为两组：factor=0 组和 factor=1 组
  let groupField;
  if (factor === 'smoking_history') {
    // 用 d.smoker（二元）来分组
    groupField = 'smoker';
  } else {
    groupField = factor;
  }

  const group0 = data.filter(d => d[groupField] === 0);
  const group1 = data.filter(d => d[groupField] === 1);

  // 颜色：组0 用蓝色，组1 用红色
  const color0 = '#1f77b4';
  const color1 = '#d62728';

  // 绘制散点：组0
  svg.selectAll('.dot0')
    .data(group0)
    .enter()
    .append('circle')
    .attr('class', 'dot0')
    .attr('cx', d => xScale(d.bmi))
    .attr('cy', d => yScale(d.hbA1c))
    .attr('r', 4)
    .attr('fill', color0)
    .attr('opacity', 0.6)
    .on('mouseover', function(event, d) {
      d3.select(this).attr('r', 6);
      tooltip.html(
        `BMI: ${d.bmi.toFixed(1)}<br>` +
        `HbA1c: ${d.hbA1c.toFixed(1)}<br>` +
        `${formatFactorTooltip(factor, d)}`
      )
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 28) + 'px')
        .style('opacity', 1);
    })
    .on('mouseout', function() {
      d3.select(this).attr('r', 4);
      tooltip.style('opacity', 0);
    });

  // 绘製散点：組1
  svg.selectAll('.dot1')
    .data(group1)
    .enter()
    .append('circle')
    .attr('class', 'dot1')
    .attr('cx', d => xScale(d.bmi))
    .attr('cy', d => yScale(d.hbA1c))
    .attr('r', 4)
    .attr('fill', color1)
    .attr('opacity', 0.6)
    .on('mouseover', function(event, d) {
      d3.select(this).attr('r', 6);
      tooltip.html(
        `BMI: ${d.bmi.toFixed(1)}<br>` +
        `HbA1c: ${d.hbA1c.toFixed(1)}<br>` +
        `${formatFactorTooltip(factor, d)}`
      )
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 28) + 'px')
        .style('opacity', 1);
    })
    .on('mouseout', function() {
      d3.select(this).attr('r', 4);
      tooltip.style('opacity', 0);
    });

  // 计算并绘制两组的线性回归直线
  drawLinearFit(svg, group0, xScale, yScale, color0);
  drawLinearFit(svg, group1, xScale, yScale, color1);

  // 添加图例
  const legendData = [
    { label: `${formatFactorName(factor)} = 0`, color: color0 },
    { label: `${formatFactorName(factor)} = 1`, color: color1 }
  ];
  const legend = svg.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${width - 140}, 10)`);

  legend.selectAll('rect')
    .data(legendData)
    .enter()
    .append('rect')
    .attr('x', 0)
    .attr('y', (d, i) => i * 24)
    .attr('width', 18)
    .attr('height', 12)
    .attr('fill', d => d.color);

  legend.selectAll('text')
    .data(legendData)
    .enter()
    .append('text')
    .attr('x', 24)
    .attr('y', (d, i) => i * 24 + 10)
    .attr('font-size', '13px')
    .text(d => d.label);


  /************************************************************************************
   * 内部辅助函数
   ************************************************************************************/

  // 根据一个样本 d，生成鼠标悬停 tooltip 中的因子信息
  function formatFactorTooltip(factorKey, d) {
    switch (factorKey) {
      case 'hypertension':
        return `Hypertension: ${d.hypertension === 1 ? 'Yes' : 'No'}`;
      case 'smoking_history':
        return `Smoking: ${d.smoker === 1 ? 'Yes' : 'No'}`;
      case 'heart_disease':
        return `Heart Disease: ${d.heart_disease === 1 ? 'Yes' : 'No'}`;
      case 'high_bmi':
        return `High BMI (≥25): ${d.high_bmi === 1 ? 'Yes' : 'No'}`;
      default:
        return '';
    }
  }

  // 将因子键名转换成人类可读标签
  function formatFactorName(factorKey) {
    switch (factorKey) {
      case 'hypertension':
        return 'Hypertension';
      case 'smoking_history':
        return 'Smoking';
      case 'heart_disease':
        return 'HeartDisease';
      case 'high_bmi':
        return 'HighBMI';
      default:
        return factorKey;
    }
  }

  // 在给定组数据上计算线性回归，并画出直线
  function drawLinearFit(svgG, groupData, xScale, yScale, lineColor) {
    if (groupData.length < 2) return; // 样本数不足时跳过

    // 计算回归系数：slope 和 intercept
    const n = groupData.length;
    const meanX = d3.mean(groupData, d => d.bmi);
    const meanY = d3.mean(groupData, d => d.hbA1c);

    let numerator = 0;
    let denominator = 0;
    groupData.forEach(d => {
      numerator += (d.bmi - meanX) * (d.hbA1c - meanY);
      denominator += (d.bmi - meanX) * (d.bmi - meanX);
    });
    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = meanY - slope * meanX;

    // 在 x 轴最两端生成两个点，用于绘制回归线
    const xMin = d3.min(groupData, d => d.bmi);
    const xMax = d3.max(groupData, d => d.bmi);
    const yMinPred = slope * xMin + intercept;
    const yMaxPred = slope * xMax + intercept;

    svgG.append('line')
      .attr('x1', xScale(xMin))
      .attr('y1', yScale(yMinPred))
      .attr('x2', xScale(xMax))
      .attr('y2', yScale(yMaxPred))
      .attr('stroke', lineColor)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '6 4')
      .attr('opacity', 0.9);
  }
}
