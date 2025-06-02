// main.js

// Wait until DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // ======================================================
  // 1. Load diabetes_prediction_dataset.csv and draw first three visualizations
  // ======================================================
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
  }))
    .then(rawData => {
      // Add a “status” field (normal / prediabetes / diabetes) and an ageGroup
      rawData.forEach(d => {
        if (d.hbA1c < 5.7) {
          d.status = 'normal';
        } else if (d.hbA1c < 6.5) {
          d.status = 'prediabetes';
        } else {
          d.status = 'diabetes';
        }

        if (d.age <= 20) {
          d.ageGroup = '0–20';
        } else if (d.age <= 40) {
          d.ageGroup = '20–40';
        } else if (d.age <= 60) {
          d.ageGroup = '40–60';
        } else if (d.age <= 80) {
          d.ageGroup = '60–80';
        } else {
          d.ageGroup = 'Other';
        }
      });

      // Draw the first three visualizations
      drawHistogram(rawData);
      drawAgeViolinGenderBox(rawData);
      drawRiskCurve(rawData);
    })
    .catch(error => {
      console.error('Failed to load diabetes_prediction_dataset.csv:', error);
    });

  // ======================================================
  // 2. Load diabetes_with_HbA1c.csv and draw the fourth visualization
  // ======================================================
  d3.csv('data/diabetes_with_HbA1c.csv', d => ({
    Diabetes_012: +d.Diabetes_012,                 // 0 / 1 / 2
    HighBP: +d.HighBP,                             // 0 / 1
    HighChol: +d.HighChol,                         // 0 / 1
    CholCheck: +d.CholCheck,                       // 0 / 1
    BMI: +d.BMI,                                   // numeric
    Smoker: +d.Smoker,                             // 0 / 1
    Stroke: +d.Stroke,                             // 0 / 1
    HeartDiseaseorAttack: +d.HeartDiseaseorAttack, // 0 / 1
    PhysActivity: +d.PhysActivity,                 // 0 / 1
    Fruits: +d.Fruits,                             // 0 / 1
    Veggies: +d.Veggies,                           // 0 / 1
    HvyAlcoholConsump: +d.HvyAlcoholConsump,       // 0 / 1
    AnyHealthcare: +d.AnyHealthcare,               // 0 / 1
    NoDocbcCost: +d.NoDocbcCost,                   // 0 / 1
    GenHlth: +d.GenHlth,                           // 1–5
    MentHlth: +d.MentHlth,                         // days
    PhysHlth: +d.PhysHlth,                         // days
    DiffWalk: +d.DiffWalk,                         // 0 / 1
    Sex: +d.Sex,                                   // 0 / 1
    Age: +d.Age,                                   // numeric code
    Education: +d.Education,                       // 1–6
    Income: +d.Income,                             // 1–8
    HbA1c: +d.HbA1c                               // numeric
  }))
    .then(caseData => {
      // Initially draw with the default dropdown value (HighBP)
      const defaultVar = d3.select('#caseVarSelect').property('value');
      drawCasePlot(caseData, defaultVar);

      // Redraw whenever the dropdown changes
      d3.select('#caseVarSelect').on('change', function () {
        const selectedVar = d3.select(this).property('value');
        drawCasePlot(caseData, selectedVar);
      });
    })
    .catch(error => {
      console.error('Failed to load diabetes_with_HbA1c.csv:', error);
    });

  // ======================================================
  // 3. Initialize Carousel (slideshow)
  // ======================================================
  const slides = document.querySelectorAll('.carousel .slide');
  let currentIndex = 0;
  const slideCount = slides.length;
  const intervalTime = 3000; // switch every 3 seconds
  if (slideCount > 1) {
    setInterval(() => {
      slides[currentIndex].classList.remove('active');
      currentIndex = (currentIndex + 1) % slideCount;
      slides[currentIndex].classList.add('active');
    }, intervalTime);
  }
});


// ======================================================
// 1. Population-Level HbA1c Distribution → Animated Histogram
// ======================================================
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

  // 按 status 分组
  const dataAll = data;
  const dataNormal = data.filter(d => d.status === 'normal');
  const dataPre = data.filter(d => d.status === 'prediabetes');
  const dataDia = data.filter(d => d.status === 'diabetes');

  // X 轴范围
  const xDomain = [
    d3.min(dataAll, d => d.hbA1c) - 0.5,
    d3.max(dataAll, d => d.hbA1c) + 0.5
  ];
  const x = d3.scaleLinear().domain(xDomain).range([0, width]);

  // histogram 生成器
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

  // 绘制 X 轴
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x));

  // 绘制 Y 轴
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y));

  // 创建 tooltip 元素（初始 display: none; opacity: 0）
  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip');

  // 绘制初始的柱状图
  const rects = svg.selectAll('rect')
    .data(currentBins)
    .enter()
    .append('rect')
    .attr('x', d => x(d.x0) + 1)
    .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 1))
    .attr('y', height)
    .attr('height', 0)
    .attr('fill', '#69b3a2');

  // 鼠标交互：mouseover, mouseout
  rects
    .on('mouseover', function (event, d) {
      // 先显示 tooltip，再渐变到 opacity = 1
      tooltip
        .style('display', 'block')
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 30) + 'px')
        .html(`Range: ${d.x0.toFixed(1)} – ${d.x1.toFixed(1)}<br>Count: ${d.length}`)
        .transition()
        .duration(100)
        .style('opacity', 1);

      d3.select(this).attr('fill', '#ff7f0e');
    })
    .on('mouseout', function () {
      // 点击移出时，先把 opacity 变为 0，然后在过渡结束后把 display 设为 none
      tooltip.transition()
        .duration(200)
        .style('opacity', 0)
        .on('end', () => {
          tooltip.style('display', 'none');
        });

      d3.select(this).attr('fill', '#69b3a2');
    });

  // 初始动画：柱子从底部“长出”
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



// ======================================================
// 2. Age-Group Violin & Gender Box Plots
// ======================================================
function drawAgeViolinGenderBox(data) {
  // Define age groups
  const ageBins = ['0–20', '20–40', '40–60', '60–80'];
  const ageGrouped = {};
  ageBins.forEach(bin => (ageGrouped[bin] = []));
  data.forEach(d => {
    if (ageGrouped[d.ageGroup] !== undefined) {
      ageGrouped[d.ageGroup].push(d.hbA1c);
    }
  });

  // Group by gender
  const genderBins = ['Male', 'Female'];
  const genderGrouped = { 'Male': [], 'Female': [] };
  data.forEach(d => {
    if (genderGrouped[d.gender] !== undefined) {
      genderGrouped[d.gender].push(d.hbA1c);
    }
  });

  // -------------------------------
  // 2a) Violin Plot: HbA1c by Age Group
  // -------------------------------
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

    // Draw axes
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

    // Kernel Density Estimator functions
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

    // Compute density for each age group
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

    // Draw each violin
    allDensities.forEach(group => {
      const center = x(group.bin) + x.bandwidth() / 2;
      const grp = svg.append('g');

      // Right half
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

      // Left half
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

  // -------------------------------
  // 2b) Box Plot: HbA1c by Gender
  // -------------------------------
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

    // Draw axes
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

    // Compute boxplot statistics for each gender
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

    // Draw each box
    const boxWidth = x.bandwidth() * 0.5;
    boxData.forEach(d => {
      const cx = x(d.gender) + x.bandwidth() / 2;

      // Box
      svg.append('rect')
        .attr('x', cx - boxWidth / 2)
        .attr('y', y(d.q3))
        .attr('width', boxWidth)
        .attr('height', y(d.q1) - y(d.q3))
        .attr('fill', '#ff7f0e')
        .attr('opacity', 0.6)
        .attr('stroke', '#cc6600')
        .attr('stroke-width', 1);

      // Median line
      svg.append('line')
        .attr('x1', cx - boxWidth / 2)
        .attr('x2', cx + boxWidth / 2)
        .attr('y1', y(d.median))
        .attr('y2', y(d.median))
        .attr('stroke', '#cc6600')
        .attr('stroke-width', 2);

      // Whiskers
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

      // Whisker caps
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


// ======================================================
// 3. HbA1c Threshold vs. Diabetes Proportion → Slider + Line Chart
// ======================================================
function drawRiskCurve(data) {
  // Get min/max HbA1c values
  const allHbValues = data.map(d => d.hbA1c);
  const minHb = d3.min(allHbValues);
  const maxHb = d3.max(allHbValues);

  // Configure slider
  const hbSlider = d3.select('#hbSlider')
    .attr('min', minHb.toFixed(1))
    .attr('max', maxHb.toFixed(1))
    .attr('value', minHb.toFixed(1));

  d3.select('#thresholdValue').text(minHb.toFixed(1));

  // Generate thresholds in steps of 0.1
  const thresholds = d3.range(minHb, maxHb + 0.0001, 0.1).map(d => +d.toFixed(1));

  // Compute diabetes proportion for each threshold
  const proportionData = thresholds.map(thr => {
    const subset = data.filter(d => d.hbA1c >= thr);
    if (subset.length === 0) {
      return { threshold: thr, prop: 0 };
    }
    const countDi = subset.filter(d => d.diabetes === 1).length;
    return { threshold: thr, prop: countDi / subset.length };
  });

  // SVG dimensions
  const margin = { top: 20, right: 30, bottom: 40, left: 60 };
  const svgWidth = 500;
  const svgHeight = 350;
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  // Clear previous
  d3.select('#riskBar').selectAll('*').remove();

  const svg = d3.select('#riskBar')
    .append('svg')
    .attr('width', svgWidth)
    .attr('height', svgHeight)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // X scale: HbA1c threshold
  const xScale = d3.scaleLinear()
    .domain([minHb, maxHb])
    .range([0, chartWidth]);

  // Y scale: proportion 0–1
  const yScale = d3.scaleLinear()
    .domain([0, 1])
    .range([chartHeight, 0]);

  // Draw axes
  svg.append('g')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale).ticks(6));

  svg.append('g')
    .call(d3.axisLeft(yScale).tickFormat(d3.format('.0%')).ticks(5));

  // X axis label
  svg.append('text')
    .attr('x', chartWidth / 2)
    .attr('y', chartHeight + margin.bottom - 5)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .text('HbA1c Threshold');

  // Y axis label
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -chartHeight / 2)
    .attr('y', -margin.left + 15)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .text('Proportion of Diabetes');

  // Draw line
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

  // Initial active circle at min threshold
  const activePoint = svg.append('circle')
    .attr('cx', xScale(minHb))
    .attr('cy', yScale(proportionData[0].prop))
    .attr('r', 6)
    .attr('fill', '#ff7f0e')
    .attr('stroke', '#cc6600')
    .attr('stroke-width', 1.5);

  // Percentage text above circle
  const percentText = svg.append('text')
    .attr('x', xScale(minHb))
    .attr('y', yScale(proportionData[0].prop) - 10)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .attr('fill', '#333')
    .text((proportionData[0].prop * 100).toFixed(1) + '%');

  // Update function when slider changes
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

  // Draw initial
  updateActivePoint(minHb);

  hbSlider.on('input', function () {
    const curVal = +this.value;
    d3.select('#thresholdValue').text(curVal.toFixed(1));
    updateActivePoint(curVal);
  });
}


// ======================================================
// 4. Individual Variables vs HbA1c Scatter Plot
// ======================================================
function drawCasePlot(data, variableKey) {
  // Clear previous plot & tooltips
  d3.select('#casePlot').selectAll('*').remove();
  d3.selectAll('.tooltip').remove();

  // (Optionally) Limit to first 5000 points for performance
  const plotData = data.slice(0, 5000);

  // Set margins and dimensions
  const margin = { top: 40, right: 150, bottom: 60, left: 60 };
  const container = document.getElementById('casePlot');
  if (!container) {
    console.error('Cannot find #casePlot container');
    return;
  }
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  const width = containerWidth - margin.left - margin.right;
  const height = containerHeight - margin.top - margin.bottom;

  // Create SVG canvas
  const svg = d3.select('#casePlot')
    .append('svg')
    .attr('width', containerWidth)
    .attr('height', containerHeight)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // X axis: selected binary variable (0/1) with jitter
  const xScale = d3.scaleLinear()
    .domain([-0.2, 1.2])
    .range([0, width]);

  // Y axis: HbA1c
  const yMin = d3.min(plotData, d => d.HbA1c) - 0.2;
  const yMax = d3.max(plotData, d => d.HbA1c) + 0.2;
  const yScale = d3.scaleLinear()
    .domain([yMin, yMax])
    .range([height, 0]);

  // Draw axes
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).tickFormat(d => (d === 0 ? '0' : (d === 1 ? '1' : ''))));
  svg.append('g')
    .call(d3.axisLeft(yScale).ticks(8));

  // Axis labels
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height + margin.bottom - 10)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .text(`${variableKey} (0 or 1)`);

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -margin.left + 15)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .text('HbA1c (%)');

  // Tooltip container
  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip');

  // Color by Diabetes_012 (0 / 1 / 2)
  const diabetesCategories = Array.from(new Set(plotData.map(d => d.Diabetes_012)));
  const colorScale = d3.scaleOrdinal()
    .domain(diabetesCategories)
    .range(['#1f77b4', '#ff7f0e', '#2ca02c']);

  // Draw points
  svg.selectAll('.dot-case')
    .data(plotData)
    .enter()
    .append('circle')
    .attr('class', 'dot-case')
    .attr('cx', d => {
      const raw = d[variableKey];
      return xScale(raw + (Math.random() * 0.2 - 0.1));
    })
    .attr('cy', d => yScale(d.HbA1c))
    .attr('r', 4)
    .attr('fill', d => colorScale(d.Diabetes_012))
    .attr('opacity', 0.75)
    .on('mouseover', function (event, d) {
      d3.select(this)
        .attr('r', 6)
        .attr('stroke', '#333')
        .attr('stroke-width', 1);

      const statusText = d.Diabetes_012 === 0 ? 'No Diabetes'
        : (d.Diabetes_012 === 1 ? 'Prediabetes' : 'Diabetes');

      const textHtml = `
        <strong>${variableKey}:</strong> ${d[variableKey] === 1 ? 'Yes' : 'No'}<br/>
        <strong>HbA1c:</strong> ${d.HbA1c.toFixed(1)}%<br/>
        <strong>Status:</strong> ${statusText}
      `;
      tooltip.html(textHtml)
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 28) + 'px')
        .style('opacity', 1);
    })
    .on('mouseout', function () {
      d3.select(this)
        .attr('r', 4)
        .attr('stroke', 'none');
      tooltip.style('opacity', 0);
    });

  // Draw legend on the right
  const legend = svg.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${width + 20}, 0)`);

  diabetesCategories.forEach((cat, i) => {
    const row = legend.append('g')
      .attr('transform', `translate(0, ${i * 20})`);

    row.append('rect')
      .attr('width', 14)
      .attr('height', 14)
      .attr('fill', colorScale(cat))
      .attr('stroke', '#555')
      .attr('stroke-width', 0.5);

    const labelText = cat === 0 ? 'No Diabetes'
      : (cat === 1 ? 'Prediabetes' : 'Diabetes');

    row.append('text')
      .attr('x', 20)
      .attr('y', 12)
      .attr('font-size', '12px')
      .text(labelText);
  });
}
