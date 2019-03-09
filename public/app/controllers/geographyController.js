angular.module('wigs')

.controller('geographyController', ['$scope', 'mapService', 'lineChartService', 'toGeoJSON',
 function($scope, mapService, lineChartService, toGeoJSON) {
	var vm = this;

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

	mapService.setMap(map);

	const baseLayers = [
		'atlanta-health-coverage',
		'atlanta-health-private'
	];

	const colors = mapService.colors;

	vm.baseLayer = 'roads';

	vm.yAxisValue = 'distance';

	vm.changeYAxis =  function(value) {
		lineChartService.changeYAxis(value);
	}

	/**
	 *
	 * Display optional additional map layers
	 * baseLayers array contains the precise names of layers specified in my custom Mapbox Studio Style.
	 * The word "roads" refers to the actual base map that should always be displayed.
	 * If "roads" is selected, the additional layers should all become invisible.
	 *
	 */
	vm.changeBaseLayer = function() {
		baseLayers.forEach(function(d) {
			if(vm.baseLayer === 'roads') {
				map.setLayoutProperty(d, 'visibility', 'none');
			} else if(d === vm.baseLayer) {
				map.setLayoutProperty(d, 'visibility', 'visible');
			} else {
				map.setLayoutProperty(d, 'visibility', 'none');
			}
		});
	}

	/**
	 *
	 * Import the selected files
	 * Expects GPX files and converts those to geojson
	 *
	 */
	vm.upload = function(files) {
		if (files.length <= 0) {
			return false;
		} else {
			processFiles(files).then(function(res) {
				processGeojson();
				lineChartService.render();
			});
		}
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

	/**
	 *
	 * Process each file within a promise
	 * Resolve the promise after file has been loaded and converted to geojson
	 *
	 */
	function processFile(file) {
		var fileType = getFileType(file);
		return new Promise(function(resolve, reject) {
			var fr = new FileReader();
			fr.onload = function(e) {
				mapService.pathsLookup["path" + mapService.pathNumber++] = convertToGeoJSON(e.target.result, fileType);
				resolve(mapService.pathsLookup);
			}
			fr.readAsText(file);
		});
	}

	function getFileType(file) {
		var splitName = file.name.split('.');
		return splitName[splitName.length -1];
	}

	function convertToGeoJSON(fileContent, fileType) {
		var geojson;
		if(fileType === 'gpx') {
			geojson = toGeoJSON.gpx((new DOMParser()).parseFromString(fileContent, 'text/xml'));
		} else if(fileType === 'csv' || fileType === 'tsv') {
			csv2geojson.csv2geojson(fileContent, {
			    latfield: 'X',
			    lonfield: 'Y',
			    delimiter: ','
			}, function(err, data) {
				geojson = data;
			});
		} else if(fileType === 'json' || 'geojson') {
			geojson = fileContent;
		}
		return geojson;
	}

	function processGeojson() {
		console.log("processing geojson");
		for (key in mapService.pathsLookup) {
			var path = mapService.pathsLookup[key];
			addDistanceData(path);
			addPath(path, key);
		}
		console.log(lineChartService.data);
	}

	/**
	 *
	 * Calculate accumulated distance for each coordinate.
	 * Build array of objects for the lineChart
	 *
	 */
	function addDistanceData(path) {
		var data = [];
		var coords = path.features[0].geometry.coordinates;
		var coordTimes = path.features[0].properties.coordTimes;
		
		/**
		 *
		 * If geojson is a single LineString, coords will be an array of all coordinates.
		 * If geojson is a MultiLineString, coords will be an array of arrays of coordinates.
		 * MultiLineStrings must be handled specially so that distances are accurate.
		 *
		 */
		if(path.features[0].geometry.type === 'LineString') {
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
		} else if(path.features[0].geometry.type === 'MultiLineString') {
			/**
			 *
			 * Maintain a list of accumulated distance as of the end of each segment in distanceAsOfSegment.
			 * These values are added to subsequent line segment distances to account for prior distance traveled.
			 * This ensures that distance from all line segments counts towards total distance accumulation,
			 * and that distance is not counted from the end point of one segment to the start point of a new segment.
			 *
			 */
			var distanceAsOfSegment = [];
			coords.forEach(function(segment, ii) {
				segment.forEach(function(c, i) {
					var distance = 0;
					if(i > 0) {
						var line = turf.linestring(segment.slice(0, i));
						distance = turf.lineDistance(line);
					}
					if(ii > 0) {
						distance = distance + distanceAsOfSegment[ii - 1];
					}
					if(i == segment.length - 1) {
						distanceAsOfSegment.push(distance);
					}
					data.push({
						date: new Date(coordTimes[ii][i]),
						distance: distance,
						lat: c[1],
						long: c[0]
					});
				});
			});
		}

		lineChartService.data.push(data);
		console.log("added a distance array");
		return lineChartService.data;
	}

	/**
	 *
	 * Adds a new layer on the map for drawing a new path
	 * Path layers are given unique identifiers in the form of path[NUMBER]
	 * The original geojson containing the path points is maintained in mapService.pathsLookup using the unique id
	 * Also adds a point for each line to mark the current location when hover over the line chart.
	 * Points are initialized at the path's first set of coordinates.
	 *
	 */
	function addPath(geojson, layerId) {
		var number = layerId.split("path")[1];
		var color = number <= colors.length - 1 ? colors[number] : colors[number % colors.length];
		var geometryType = geojson.features[0].geometry.type;
		var pointInitialCoordinates = null;

		if(geometryType === 'LineString') {
			pointInitialCoordinates = geojson.features[0].geometry.coordinates[0];
		} else if(geometryType === 'MultiLineString') {
			pointInitialCoordinates = geojson.features[0].geometry.coordinates[0][0];
		}
		
		var layer = {
			"id": layerId,
			"type": "line",
			"source": {
				"type": "geojson",
				"data": {
					"type": "Feature",
					"properties": {},
					"geometry": {
						"type": geometryType,
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
						"coordinates": pointInitialCoordinates
					}
				}
			},
			"paint": {
				"circle-radius": 7,
				"circle-color": color,
				"circle-opacity": 0.75,
				"circle-stroke-color": "#000",
				"circle-stroke-width": 2
			}
		};

		map.addLayer(layer);
		map.addLayer(point);

		return mapService.pathsLookup;
	}
}]);

