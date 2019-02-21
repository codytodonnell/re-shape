var app = (function () {
	/**
	 *
	 * Initialize the Mapbox map
	 * Center point determined using bboxfinder.com
	 *
	 */
	mapboxgl.accessToken = 'pk.eyJ1IjoiY29kb25uZWxsIiwiYSI6ImNqbmNhaTlrNzBndDIzcHBvYnNla2RneHAifQ.OMGQ5aqcWXSsAKc8niEsEw';
	var map = new mapboxgl.Map({
		container: 'map',
		style: 'mapbox://styles/codonnell/cjs27n4bx1jcl1fpo320lk0pt',
		center: [-84.348907,33.818527],
		zoom: 12.0
	});
	const baseLayers = [
		'atlanta-health-coverage',
		'atlanta-health-private'
	];
	var pathNumber = 0;
	var pathsLookup = {};
	var colors = ["#66c2a5","#e78ac3","#ffd92f","#e5c494","#b3b3b3","#8da0cb","#fc8d62","#a6d854"];
	var dateMax = null;
	var dateMin = null;
	var distanceMax = null;

	/**
	 *
	 * Adds a new layer on the map for drawing a new path
	 * Path layers are given unique identifiers in the form of path[NUMBER]
	 * The original geojson containing the path points is maintained in pathsLookup using the unique id
	 *
	 */
	function addPath(geojson, layerId) {
		var number = layerId.split("path")[1];
		var color = number <= colors.length - 1 ? colors[number] : colors[number % colors.length];
		var layer = {
			"id": layerId,
			"type": "line",
			"source": {
				"type": "geojson",
				"data": {
					"type": "Feature",
					"properties": {},
					"geometry": {
						"type": geojson.features[0].geometry.type,
						"coordinates": []
					}
				}
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"paint": {
				"line-color": color,
				"line-width": 3
			}
		};
		var point = {
			"id": "point" + number,
			"type": "circle",
			"source": {
				"type": "geojson",
				"data": {
					"type": "Feature",
					"properties": {},
					"geometry": {
						"type": "Point",
						"coordinates": geojson.features[0].geometry.coordinates[0]
					}
				}
			},
			"paint": {
				"circle-radius": 7,
				"circle-color": "#000",
				"circle-opacity": 0.5,
				"circle-stroke-color": "#aaa",
				"circle-stroke-width": 2
			}
		};
		map.addLayer(layer);
		map.addLayer(point);

		return pathsLookup;
	}

	/**
	 *
	 * For each path in pathsLookup, draw the path on the map
	 * Only draws the points that fall within the time range set by the brush
	 *
	 */
	function drawFilteredPath() {
		for (key in pathsLookup) {
			var path = pathsLookup[key];
			var pathData = path.features[0];
			var data = {
				"type": "Feature",
				"properties": {
					"name": pathData.properties.name,
					"time": pathData.properties.time,
					"coordTimes": []
				},
				"geometry": {
					"type": pathData.geometry.type,
					"coordinates": []
				}
			};

			// Need to fix this to handle multiLineStrings, not just LineStrings

			// Find the first coordinate that is greater than or equal to the minimum bound on the brush
			var filterIndexMin = pathData.properties.coordTimes.findIndex(function(t) {
				var coordTime = new Date(t);
				var filteredDomain = lineChart.xScale.domain();
				return coordTime >= filteredDomain[0];
			});

			// Find the first coordinate that is greater than or equal to the maximum bound on the brush
			var filterIndexMax = pathData.properties.coordTimes.findIndex(function(t) {
				var coordTime = new Date(t);
				var filteredDomain = lineChart.xScale.domain();
				return coordTime >= filteredDomain[1];
			});

			// Slice the coordinates and times based on the range of the brush
			var filteredCoords = pathData.geometry.coordinates.slice(filterIndexMin, filterIndexMax);
			var filteredCoordTimes = pathData.properties.coordTimes.slice(filterIndexMin, filterIndexMax);

			data.properties.coordTimes = filteredCoordTimes;
			data.geometry.coordinates = filteredCoords;
			data.properties.distance = turf.lineDistance(data);
			map.getSource(key).setData(data);
			d3.select('#' + key)
				.text(data.properties.distance.toLocaleString() + " km");
		};
	}

	function moveLocationPoints(selectedTime) {
		for (key in pathsLookup) {
			var path = pathsLookup[key];
			var pathData = path.features[0];
			var number = key.split("path")[1];
			var data = {
				"type": "Point",
				"coordinates": []
			};
			var coordIndex = pathData.properties.coordTimes.findIndex(function(t) {
				var coordTime = new Date(t);
				return coordTime >= selectedTime;
			});
			data.coordinates = pathData.geometry.coordinates[coordIndex];
			map.getSource('point' + number).setData(data);
		}
	}

	/**
	 *
	 * Import the selected files
	 * Expects GPX files and converts those to geojson
	 *
	 */
	function upload() {
		var files = document.getElementById('customFile').files;
		console.log(files);
		if (files.length <= 0) {
			return false;
		} else {
			processFiles(files).then(function(res) {
				processGeojson();
				lineChart.render();
			});
		}
	}

	/**
	 *
	 * Process each file within a promise
	 * Resolve the promise after file has been loaded and converted to geojson
	 *
	 */
	function processFile(file) {
		return new Promise(function(resolve, reject) {
			var fr = new FileReader();
			fr.onload = function(e) { 
				var geojsonPath = toGeoJSON.gpx((new DOMParser()).parseFromString(e.target.result, 'text/xml'));
				pathsLookup["path" + pathNumber++] = geojsonPath;
				resolve(pathsLookup);
			}
			fr.readAsText(file);
		});
	}

	/**
	 *
	 * Process batch of files asynchronously
	 * Wait for each file to process before continuing
	 * This ensures that the geojson has been built 
	 * and stored before attempting to manipulate it
	 *
	 */
	async function processFiles(files) {
		console.log("processing files");
		for (const file of files) {
			await processFile(file);
		}
		console.log("done processing files");
	}

	function processGeojson() {
		console.log("processing geojson");
		for (key in pathsLookup) {
			var path = pathsLookup[key];
			addDistanceData(path);
			addPath(path, key);
		}
		console.log(lineChart.data);
	}

	function addDistanceData(path) {
		console.log("adding distance");
		var data = [];
		var coords = path.features[0].geometry.coordinates;
		var coordTimes = path.features[0].properties.coordTimes;
		coords.forEach(function(c, i) {
			var distance = 0;
			if(i > 0) {
				var line = turf.linestring(coords.slice(0, i));
				distance = turf.lineDistance(line);
			}
			data.push({
				date: new Date(coordTimes[i]),
				distance: distance,
				lat: c[1],
				long: c[0]
			});
		});
		lineChart.data.push(data);
		console.log("added a distance array");
		return lineChart.data;
	}

	/**
	 *
	 * Display optional additional map layers
	 * baseLayers array contains the precise names of layers specified in my custom Mapbox Studio Style.
	 * The word "roads" refers to the actual base map that should always be displayed.
	 * If "roads" is selected, the additional layers should all become invisible.
	 *
	 */
	function changeBaseLayer(layerId) {
		baseLayers.forEach(function(d) {
			if(layerId === 'roads') {
				map.setLayoutProperty(d, 'visibility', 'none');
			} else if(d === layerId) {
				map.setLayoutProperty(d, 'visibility', 'visible');
			} else {
				map.setLayoutProperty(d, 'visibility', 'none');
			}
		})
	}

	return {
		colors: colors,
		drawFilteredPath: drawFilteredPath,
		upload: upload,
		changeBaseLayer: changeBaseLayer,
		moveLocationPoints: moveLocationPoints
	}
})();