// Reference: https://bl.ocks.org/officeofjane/47d2b0bfeecfcb41d2212d06d095c763
var slider = (function () {

	var container = d3.select("#slider");

	var fullWidth = parseInt(container.style('width')),
	    fullHeight = parseInt(container.style('height'));

	var margin = {top: 20, right: 15, bottom: 30, left: 15},
	    width = fullWidth - margin.left - margin.right,
	    height = fullHeight - margin.top - margin.bottom;

	var svg = container
	    .append("svg")
	    .attr("width", fullWidth)
	    .attr("height", fullHeight);
	 //    .attr("preserveAspectRatio", "xMinYMin meet")
		// .attr("viewBox", "0 0 " + fullWidth + " " + fullHeight);

	var startTime = new Date();
	var endTime = new Date();
	endTime.setDate(startTime.getDate()+1);
	var formatHandleLabel = d3.timeFormat("%B %d %I:%M%p");
	var formatTickTop = d3.timeFormat("%I:%M%p");
	var formatTickBottom = d3.timeFormat("%m/%d");
	var parseDate = d3.timeParse("%m/%d/%y");
	var moving = false;
	var current = {value: 0};
	var targetValue = width;
	var playButton = d3.select("#play-button");

	/**
	 *
	 * The slider takes a time between two boundaries
	 * and converts that to a position between 0 and the width of the slider.
	 *
	 */
	var xScale = d3.scaleTime()
	    .domain([startTime, endTime])
	    .range([0, targetValue])
	    .clamp(true);

	var sliderElem = svg.append("g")
	    .attr("class", "slider")
	    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	sliderElem.append("line")
	    .attr("class", "track")
	    .attr("x1", xScale.range()[0])
	    .attr("x2", xScale.range()[1])
	  .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
	    .attr("class", "track-inset")
	  .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
	    .attr("class", "track-overlay")
	    .call(d3.drag()
	        .on("start.interrupt", function() { sliderElem.interrupt(); })
	        .on("start drag", drag)
	    );

	var ticks = sliderElem.insert("g", ".track-overlay")
	    .attr("class", "ticks")
	    .attr("transform", "translate(0," + 18 + ")");
	
	ticks.selectAll(".tick-top")
	    .data(xScale.ticks(10))
	    .enter()
	    .append("text")
	    .attr("class", "tick-top")
	    .attr("x", xScale)
	    .attr("y", 0)
	    .attr("text-anchor", "middle")
	    .text(function(d) { return formatTickTop(d); });

	ticks.selectAll(".tick-bottom")
	    .data(xScale.ticks(10))
	    .enter()
	    .append("text")
	    .attr("class", "tick-bottom")
	    .attr("x", xScale)
	    .attr("y", 10)
	    .attr("text-anchor", "middle")
	    .text(function(d) { return formatTickBottom(d); });

	var handle = sliderElem.insert("circle", ".track-overlay")
	    .attr("class", "handle")
	    .attr("r", 9);

	// var label = sliderElem.append("text")  
	//     .attr("class", "label")
	//     .attr("text-anchor", "middle")
	//     .text(formatHandleLabel(startTime))
	//     .attr("transform", "translate(0," + (-25) + ")");

	var label = d3.select(".time-label")  
	    .text(formatHandleLabel(startTime));

	playButton.on("click", function() {
		var button = d3.select(this);
		if (button.text() == "Pause") {
			moving = false;
			clearInterval(timer);
			// timer = 0;
			button.text("Play");
		} else {
			moving = true;
			timer = setInterval(step, 100);
			button.text("Pause");
		}
		console.log("Slider moving: " + moving);
	});

	/**
	 *
	 * Step is called as the slider is auto-playing
	 * As the slider moves, update the handle label
	 * and continue drawing the map path filtered by the time.
	 * Play stops when the max slider value is reached.
	 *
	 */
	function step() {
		update(xScale.invert(current.value));
		current.value = current.value + (targetValue/151);
		app.drawFilteredPath();
		if (current.value > targetValue) {
			moving = false;
			current.value = 0;
			clearInterval(timer);
			// timer = 0;
			playButton.text("Play");
			console.log("Slider moving: " + moving);
		}
	}


	/**
	 *
	 * Drag does the same things step() does but on slider drag
	 *
	 */
	function drag() {
		current.value = d3.event.x;
		update(xScale.invert(current.value)); 
		app.drawFilteredPath();
	}

	/**
	 *
	 * Update position and text of label according to slider scale
	 *
	 */
	function update(h) {
	  	handle.attr("cx", xScale(h));
	  	label.text(formatHandleLabel(h));

	  	svg.selectAll('.tick-top')
	  		.data(xScale.ticks(10))
			.text(function(d) { return formatTickTop(d); });

		svg.selectAll('.tick-bottom')
			.data(xScale.ticks(10))
			.text(function(d) { return formatTickBottom(d); });
	}

	return {
		xScale: xScale,
		current: current,
		update: update
	}
})();