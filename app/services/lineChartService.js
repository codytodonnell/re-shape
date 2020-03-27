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

	var margin = {top: fullHeight*0.12, right: 0, bottom: 0, left: 0},
		marginMini = {top: fullHeight*0.005, right: 25, bottom: fullHeight*0.9, left: 25},
	    width = fullWidth - margin.left - margin.right,
	    widthMini = fullWidth - marginMini.left - marginMini.right;
	    height = fullHeight - margin.top - margin.bottom,
	    heightMini = fullHeight - marginMini.top - marginMini.bottom;

	var data = {
		tracks: []
	};

	var colors = mapService.colors;

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
		.range([0, widthMini])
		.domain([new Date(), new Date()]);

	var yScaleMini = d3.scaleLinear()
		.range([heightMini, 0])
		.domain([0, 100]);

	var xAxis = d3.axisBottom(xScale).ticks(5).tickFormat(d3.timeFormat("%m/%d %I%p")),
		xAxisMini = d3.axisBottom(xScaleMini).ticks(5).tickFormat(d3.timeFormat("%m/%d %I%p")),
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
	    .extent([[0, 0], [widthMini, heightMini]])
	    .on("end", brushed);

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

	positionTicks();

	var mini = svg.append("g")
	    .attr("class", "mini")
	    .attr("width", widthMini)
	    .attr("transform", "translate(" + marginMini.left + "," + marginMini.top + ")");

	mini.append("g")
      	.attr("class", "axis x")
      	.attr("transform", "translate(0," + heightMini + ")")
      	.call(xAxisMini);

  	mini.append("g")
      	.attr("class", "brush")
      	.attr("width", widthMini)
      	.call(brush)
      	.call(brush.move, xScaleMini.range());

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

		data.tracks.forEach(function(segment) {
			segment.forEach(function(d) {
				mergedData = mergedData.concat(d);
			});
		});

		var miniBoundKey = ySelector.value === 'distance' ? ySelector.value : 'mini' + ySelector.value;

		// Scale the range of the data
		min.minilat = d3.min(mergedData, function(d) { return d.lat; });
		max.minilat = d3.max(mergedData, function(d) { return d.lat; });
		min.minilong = d3.min(mergedData, function(d) { return d.long; });
		max.minilong = d3.max(mergedData, function(d) { return d.long; });
		min.distance = d3.min(mergedData, function(d) { return d.distance; });
		max.distance = d3.max(mergedData, function(d) { return d.distance; });
		max.distance = d3.min([100, max.distance]);
		xScale.domain(d3.extent(mergedData, function(d) { return d.date; }));
		xScaleMini.domain(d3.extent(mergedData, function(d) { return d.date; }));
		yScale.domain([min[ySelector.value], max[ySelector.value]]).nice();
		yScaleMini.domain([min[miniBoundKey], max[miniBoundKey]]).nice().clamp(true);
		line.y(function(d) { return yScale(d[ySelector.value]); });
		lineMini.y(function(d) { return yScaleMini(d[ySelector.value]); });

		focus.select('.x.axis')
			.transition()
			.call(xAxis);

		focus.select('.y.axis')
			.transition()
			.call(yAxis);

		positionTicks();

		mini.select('.x.axis')
			.transition()
			.call(xAxisMini);

		var series = chart.selectAll(".series")
	        .data(data.tracks)
	        .enter().append("g")
	        .attr("class", function(d, i) {
				return "series " + "track" + i;
			});

	    var segment = series.selectAll(".segment")
	    	.data(function(d, i) {
	    		return data.tracks[i];
	    	})
	    	.enter().append("g")
	        .attr("class", "segment");

		segment.append("path")
			.attr("d", line)
			.attr("class", "line");

		series.each(function(d, i) {
			var colorIndex = i <= colors.length - 1 ? i : (i % colors.length);
        	d3.selectAll(".track" + i + " path")
        		.style("stroke", colors[colorIndex]);
        });

		var seriesMini = mini.selectAll(".series-mini")
	        .data(data.tracks)
	        .enter().append("g")
	        .attr("class", function(d, i) {
				return "series-mini " + "track" + i;
			});
			

	    var segmentMini = seriesMini.selectAll(".segment-mini")
	    	.data(function(d, i) {
	    		return data.tracks[i];
	    	})
	    	.enter().append("g")
	        .attr("class", "segment-mini");

		segmentMini.append("path")
			.attr("d", lineMini)
			.attr("class", "line");

		seriesMini.each(function(d, i) {
			var colorIndex = i <= colors.length - 1 ? i : (i % colors.length);
        	d3.selectAll(".track" + i + " path")
        		.style("stroke", colors[colorIndex]);
        });

		mapService.drawFilteredTrack(xScale.domain()[0], xScale.domain()[1]);
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
		mapService.drawFilteredTrack(xScale.domain()[0], xScale.domain()[1]);
	}

	function zoomed() {
		if (d3.event.sourceEvent && d3.event.sourceEvent.type === "brush") return; // ignore zoom-by-brush
		var t = d3.event.transform;
		xScale.domain(t.rescaleX(xScaleMini).domain());
		chart.selectAll(".line").attr("d", line);
		focus.select(".axis.x").call(xAxis);
		mini.select(".brush").call(brush.move, xScale.range().map(t.invertX, t));
		positionTicks();
		mapService.drawFilteredTrack(xScale.domain()[0], xScale.domain()[1]);
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
		var miniBoundKey = key === 'distance' ? key : 'mini' + key;
		yScale.domain([min[key], max[key]]).nice();
		yScaleMini.domain([min[miniBoundKey], max[miniBoundKey]]).nice();
		line.y(function(d) { return yScale(d[key]); });
		lineMini.y(function(d) { return yScaleMini(d[key]); });

		focus.select('.y.axis')
			.transition()
			.call(yAxis);

		mini.select('.x.axis')
			.transition()
			.call(xAxisMini);

		positionTicks();

		d3.selectAll('.series path')
			.transition()
			.duration(750)
			.attr("d", line);

		d3.selectAll('.series-mini path')
			.transition()
			.duration(750)
			.attr("d", lineMini);

	}

	function rescaleYAxis(bounds) {
		min.lat = bounds._sw.lat;
		min.long = bounds._sw.lng;
		max.lat = bounds._ne.lat;
		max.long = bounds._ne.lng;

		if(ySelector.value !== 'distance') {
			yScale.domain([min[ySelector.value], max[ySelector.value]]).nice();
			line.y(function(d) { return yScale(d[ySelector.value]); });

			focus.select('.y.axis')
				.transition()
				.call(yAxis);

			positionTicks();

			d3.selectAll('.series path')
				.transition()
				.duration(750)
				.attr("d", line);
		}
	}

	function toggleLine(trackId, visible) {
		d3.selectAll('.' + trackId)
			.transition()
			.style("opacity", function(d) {
				return visible ? 1 : 0;
			});
	}

	function clearChart() {
		d3.selectAll('.series, .series-mini').remove();
		data.tracks = [];
	}

	function positionTicks() {
		d3.selectAll(".focus .x .tick text")
			.transition()
	    	.attr("y", -20);

	   	d3.selectAll(".focus .x .tick line")
			.transition()
	    	.attr("y2", -10);

		d3.selectAll(".focus .y .tick text")
			.transition()
	    	.attr("dy", "-0.7em")
	    	.attr("x", 2)
	    	.style("text-anchor", "start");

	   	d3.selectAll(".focus .y .tick line")
			.transition()
	    	.attr("x2", 30);
	}

	return {
		data: data,
		xScale: xScale,
		xScaleMini: xScaleMini,
		yScale: yScale,
		render: render,
		changeYAxis: changeYAxis,
		rescaleYAxis: rescaleYAxis,
		toggleLine: toggleLine,
		clearChart: clearChart
	}
}]);