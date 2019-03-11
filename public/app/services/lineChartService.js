angular.module('wigs')

.factory('lineChartService', ['mapService',
function(mapService) {
	// Reference: https://bl.ocks.org/EfratVil/92f894ac0ba265192411e73f633a3e2f
	
	// set the dimensions and margins of the graph
	var container = d3.select("#line-container");

	var fullWidth = parseInt(container.style('width')) - parseInt(container.style('padding-right')) - parseInt(container.style('padding-left')),
	    fullHeight = parseInt(container.style('height'));

	// var margin = {top: 105, right: 50, bottom: 35, left: 25},
	// 	marginMini = {top: 5, right: 50, bottom: 795, left: 25},
	//     width = fullWidth - margin.left - margin.right,
	//     height = fullHeight - margin.top - margin.bottom,
	//     heightMini = fullHeight - marginMini.top - marginMini.bottom;

	var margin = {top: fullHeight*0.12, right: 50, bottom: fullHeight*0.04, left: 25},
		marginMini = {top: fullHeight*0.005, right: 50, bottom: fullHeight*0.9, left: 25},
	    width = fullWidth - margin.left - margin.right,
	    height = fullHeight - margin.top - margin.bottom,
	    heightMini = fullHeight - marginMini.top - marginMini.bottom;

	var data = [];

	var lineNumber = 0;

	// format time as 
	var formatTime = d3.timeFormat("%B %d %I:%M%p");

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

	var min = {
		lat: 0,
		long: 0,
		distance: 0
	};

	var max = {
		lat: 0,
		long: 0,
		distance: 0
	};

	var ySelector = d3.select("#y-select").node();

	// define the main line function
	var line = d3.line()
	    .x(function(d) { return xScale(d.date); })
	    .y(function(d) { return yScale(d[ySelector.value]); });

	// define the mini line function
	var lineMini = d3.line()
	    .x(function(d) { return xScaleMini(d.date); })
	    .y(function(d) { return yScaleMini(d[ySelector.value]); });

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
	          "translate(" + margin.left + "," + marginMini.top + ")");

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

    var mouseBox = svg.append("rect")
		.attr("class", "zoom")
		.attr("width", width)
		.attr("height", height)
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")")
		.on('mousemove', drawTooltip)
    	.on('mouseout', removeTooltip)
		.call(zoom);

	var tooltip = d3.select('#chart-tooltip');
	
	var tooltipLine = chart.append('line')
		.attr('class', 'tooltip-line');	

	var tooltipLineLabel = svg.append('text')
		.attr('class', 'tooltip-line-label');		

	function render() {
		var mergedData = [];

		// Need to modify to support multi line strings
		data.forEach(function(d) {
			mergedData = mergedData.concat(d);
		});

		// Scale the range of the data
		min.lat = d3.min(mergedData, function(d) { return d.lat; });
		max.lat = d3.max(mergedData, function(d) { return d.lat; });
		min.long = d3.min(mergedData, function(d) { return d.long; });
		max.long = d3.max(mergedData, function(d) { return d.long; });
		min.distance = d3.min(mergedData, function(d) { return d.distance; });
		max.distance = d3.max(mergedData, function(d) { return d.distance; });
		xScale.domain(d3.extent(mergedData, function(d) { return d.date; }));
		xScaleMini.domain(d3.extent(mergedData, function(d) { return d.date; }));
		yScale.domain([min[ySelector.value], max[ySelector.value]]).nice();
		yScaleMini.domain([min[ySelector.value], max[ySelector.value]]).nice();
		line.y(function(d) { return yScale(d[ySelector.value]); });
		lineMini.y(function(d) { return yScaleMini(d[ySelector.value]); });

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
			  .attr("class", function(d, i) {
			  	return "line " + "path" + i;
			  })
			  .attr("d", line)
			  .style("stroke", function(d, i) {
			  	return mapService.colors[i]
			  });

		var seriesMini = mini.selectAll(".series-mini")
	        .data(data)
	        .enter().append("g")
	        .attr("class", "series-mini");

		seriesMini.append("path")
			  .attr("class", function(d, i) {
			  	return "line " + "path" + i;
			  })
			  .attr("d", lineMini)
			  .style("stroke", function(d, i) {
			  	return mapService.colors[i]
			  });

		mapService.drawFilteredPath(xScale.domain()[0], xScale.domain()[1]);
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
		mapService.drawFilteredPath(xScale.domain()[0], xScale.domain()[1]);
	}

	function zoomed() {
		if (d3.event.sourceEvent && d3.event.sourceEvent.type === "brush") return; // ignore zoom-by-brush
		var t = d3.event.transform;
		xScale.domain(t.rescaleX(xScaleMini).domain());
		chart.selectAll(".line").attr("d", line);
		focus.select(".axis.x").call(xAxis);
		mini.select(".brush").call(brush.move, xScale.range().map(t.invertX, t));
		mapService.drawFilteredPath(xScale.domain()[0], xScale.domain()[1]);
	}

	function removeTooltip() {
	  	if (tooltip) tooltip.style('display', 'none');
	  	if (tooltipLine) tooltipLine.attr('stroke', 'none');
	  	if (tooltipLineLabel) tooltipLineLabel.attr('opacity', 0);
	}

	function drawTooltip() {
	  	const selectedTime = xScale.invert(d3.mouse(mouseBox.node())[0]);

	  	const labelWidth = tooltipLineLabel.node().getBBox().width;
	    
	  	tooltipLine.attr('stroke', 'black')
	    	.attr('x1', xScale(selectedTime))
	    	.attr('x2', xScale(selectedTime))
	    	.attr('y1', 20)
	    	.attr('y2', height);

	    tooltipLineLabel.attr('opacity', 1)
	    	.attr('text-anchor', 'end')
	    	.attr('x', function(d) {
	    		if(xScale(selectedTime) + (labelWidth/2) + (margin.left*2) <= fullWidth
	    			&& xScale(selectedTime) - (labelWidth/2) + margin.left >= 0) {
	    			return xScale(selectedTime) + labelWidth/2 + margin.left;
	    		} else if(xScale(selectedTime) + (labelWidth/2) + (margin.left*2) > fullWidth) {
	    			return fullWidth - margin.left;
	    		} else {
	    			return labelWidth;
	    		}
	    	})
	    	.attr('y', margin.top + 15)
	    	.text(formatTime(selectedTime));
	  
	  	tooltip.html(selectedTime)
	    	.style('display', 'block')
	    	.style('left', d3.event.pageX + 20)
	    	.style('top', d3.event.pageY - 20);

	    mapService.moveLocationPoints(selectedTime);
	}

	function changeYAxis(key) {
		yScale.domain([min[key], max[key]]).nice();
		yScaleMini.domain([min[key], max[key]]).nice();
		line.y(function(d) { return yScale(d[key]); });
		lineMini.y(function(d) { return yScaleMini(d[key]); });

		focus.select('.y.axis')
			.transition()
			.call(yAxis);

		mini.select('.x.axis')
			.transition()
			.call(xAxisMini);

		d3.selectAll('.series path')
			.transition()
			.duration(750)
			.attr("d", line);

		d3.selectAll('.series-mini path')
			.transition()
			.duration(750)
			.attr("d", lineMini);

	}

	function toggleLine(pathId, visible) {
		d3.selectAll('.' + pathId)
			.transition()
			.style("opacity", function(d) {
				return visible ? 1 : 0;
			});
	}

	return {
		data: data,
		xScale: xScale,
		xScaleMini: xScaleMini,
		yScale: yScale,
		render: render,
		changeYAxis: changeYAxis,
		toggleLine: toggleLine
	}
}]);