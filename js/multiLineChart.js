var lineChart = (function () {
	// set the dimensions and margins of the graph
	var container = d3.select("#line-container");

	var fullWidth = parseInt(container.style('width')) - parseInt(container.style('padding-right')) - parseInt(container.style('padding-left')),
	    fullHeight = parseInt(container.style('height'));

	var margin = {top: 10, right: 50, bottom: 130, left: 15},
		marginMini = {top: 650, right: 50, bottom: 30, left: 15},
	    width = fullWidth - margin.left - margin.right,
	    height = fullHeight - margin.top - margin.bottom,
	    heightMini = fullHeight - marginMini.top - marginMini.bottom;

	var data = [];

	var lineNumber = 0;

	// parse the date / time
	var parseTime = d3.timeParse("%d-%b-%y");

	// set the main chart scales
	var xScale = d3.scaleTime()
		.range([0, width])
		.domain([new Date(), new Date()]);

	var yScale = d3.scaleLinear()
		.range([height, 0])
		.domain([0, 100]);

	// set the mini chart scales
	var xScaleMini = d3.scaleTime()
		.range([0, width])
		.domain([new Date(), new Date()]);

	var yScaleMini = d3.scaleLinear()
		.range([heightMini, 0])
		.domain([0, 100]);

	var xAxis = d3.axisBottom(xScale),
		xAxisMini = d3.axisBottom(xScaleMini),
		yAxis = d3.axisLeft(yScale);

	// define the main line function
	var line = d3.line()
	    .x(function(d) { return xScale(d.date); })
	    .y(function(d) { return yScale(d.distance); });

	// define the mini line function
	var lineMini = d3.line()
	    .x(function(d) { return xScaleMini(d.date); })
	    .y(function(d) { return yScaleMini(d.distance); });

	var brush = d3.brushX()
	    .extent([[0, 0], [width, heightMini]])
	    .on("brush end", brushed);

	var zoom = d3.zoom()
	    .scaleExtent([1, Infinity])
	    .translateExtent([[0, 0], [width, height]])
	    .extent([[0, 0], [width, height]])
	    .on("zoom", zoomed);

	// append the svg obgect to the body of the page
	// appends a 'group' element to 'svg'
	// moves the 'group' element to the top left margin
	var svg = container.append("svg")
		.attr("id", "line-chart")
	    .attr("width", fullWidth)
	    .attr("height", fullHeight)
	  .append("g")
	    .attr("transform",
	          "translate(" + margin.left + "," + margin.top + ")");

	var clip = svg.append("defs").append("svg:clipPath")
        .attr("id", "clip")
        .append("svg:rect")
        .attr("width", width)
        .attr("height", height)
        .attr("x", 0)
        .attr("y", 0);

    var chart = svg.append("g")
        .attr("class", "focus")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
        .attr("clip-path", "url(#clip)");

    var focus = svg.append("g")
        .attr("class", "focus")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	// Add the X Axis
	focus.append("g")
	  	.attr("class", "x axis")
	  	.attr("transform", "translate(0," + height + ")")
	  	.call(xAxis);

	// Add the Y Axis
	focus.append("g")
	  	.attr("class", "y axis")
	  	.call(yAxis);

	var mini = svg.append("g")
	    .attr("class", "mini")
	    .attr("transform", "translate(" + marginMini.left + "," + marginMini.top + ")");

	mini.append("g")
	      	.attr("class", "axis x")
	      	.attr("transform", "translate(0," + heightMini + ")")
	      	.call(xAxisMini);

  	mini.append("g")
      	.attr("class", "brush")
      	.call(brush)
      	.call(brush.move, xScale.range());

    svg.append("rect")
		.attr("class", "zoom")
		.attr("width", width)
		.attr("height", height)
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")")
		.call(zoom);

	function render() {
		var mergedData = [];

		data.forEach(function(d) {
			mergedData = mergedData.concat(d);
		});

		// Scale the range of the data
		xScale.domain(d3.extent(mergedData, function(d) { return d.date; }));
		xScaleMini.domain(d3.extent(mergedData, function(d) { return d.date; }));
		yScale.domain([0, d3.max(mergedData, function(d) { return d.distance; })]);

		focus.select('.x.axis')
			.transition()
			.call(xAxis);

		focus.select('.y.axis')
			.transition()
			.call(yAxis);

		mini.select('.x.axis')
			.transition()
			.call(xAxisMini);

		var series = chart.selectAll(".series")
	        .data(data)
	        .enter().append("g")
	        .attr("class", "series");

		series.append("path")
			  .attr("class", "line")
			  .attr("d", line)
			  .style("stroke", function(d, i) {
			  	return app.colors[i]
			  });

		var seriesMini = mini.selectAll(".series-mini")
	        .data(data)
	        .enter().append("g")
	        .attr("class", "series-mini");

		seriesMini.append("path")
			  .attr("class", "line")
			  .attr("d", lineMini)
			  .style("stroke", function(d, i) {
			  	return app.colors[i]
			  });

		app.drawFilteredPath();
	}

	function brushed() {
		if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") return; // ignore brush-by-zoom
		var s = d3.event.selection || xScaleMini.range();
		xScale.domain(s.map(xScaleMini.invert, xScaleMini));
		chart.selectAll(".line").attr("d", line);
		focus.select(".axis.x").call(xAxis);
		svg.select(".zoom").call(zoom.transform, d3.zoomIdentity
			.scale(width / (s[1] - s[0]))
			.translate(-s[0], 0));
		app.drawFilteredPath();
	}

	function zoomed() {
		if (d3.event.sourceEvent && d3.event.sourceEvent.type === "brush") return; // ignore zoom-by-brush
		var t = d3.event.transform;
		xScale.domain(t.rescaleX(xScaleMini).domain());
		chart.selectAll(".line").attr("d", line);
		focus.select(".axis.x").call(xAxis);
		mini.select(".brush").call(brush.move, xScale.range().map(t.invertX, t));
		app.drawFilteredPath();
	}

	return {
		data: data,
		xScale: xScale,
		xScaleMini: xScaleMini,
		yScale: yScale,
		render: render
	}
})();