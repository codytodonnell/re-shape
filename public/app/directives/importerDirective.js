angular.module('wigs')

.directive('importer', function() {
	return {
		restrict: 'E',
		templateUrl: 'public/app/templates/importer.html',
		controllerAs: 'im',
		scope: {
			open: '='
		},
		bindToController: true,
		controller: ['$scope', 'mapService', 'lineChartService', 'toGeoJSON', function($scope, mapService, lineChartService, toGeoJSON) {
			var vm = this;
			var map = mapService.getMap();
			var colors = mapService.colors;

			vm.lookup = mapService.lookup;
			vm.loading = false;
			vm.numTracksToLoad = 0;

			/**
			 *
			 * Import the selected files
			 * Expects GPX files and converts those to geojson
			 *
			 */
			vm.upload = function(files) {
				if (files.length <= 0) {
					vm.numTracksToLoad = 0;
					return false;
				} else {
					vm.loading = true;
					vm.numTracksToLoad = files.length;
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
				mapService.clearMap();
				lineChartService.clearChart();
				for (const file of files) {
					await processFile(file);
				}
				vm.tracksLoaded = true;
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
						vm.lookup.tracks["track" + vm.lookup.number++] = convertToGeoJSON(e.target.result, fileType);
						resolve(vm.lookup.tracks);
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
				} else if(fileType === 'csv' || fileType === 'tsv' || fileType === 'txt') {
					csv2geojson.csv2geojson(fileContent, {
					    latfield: 'latitude',
					    lonfield: 'longitude',
					    line: true,
					    delimiter: 'auto'
					}, function(err, data) {
						geojson = csv2geojson.toLine(data);
						geojson.features[0].properties.coordTimes = geojson.features[0].properties.time.map(function(d) {
							return d + 'Z';
						});
						delete geojson.features[0].properties.time;
					});
				} else if(fileType === 'json' || 'geojson') {
					geojson = fileContent;
				}
				return geojson;
			}

			function processGeojson() {
				console.log("processing geojson");
				for (key in vm.lookup.tracks) {
					normalizeToMultiLineString(key);
					addDistanceData(key);
					addTrackToMap(key);
				}
				vm.loading = false;
				vm.numTracksToLoad = 0;
				vm.open = false;
				$scope.$apply();
			}

			function normalizeToMultiLineString(trackId) {
				var track = vm.lookup.tracks[trackId];
				var coords = track.features[0].geometry.coordinates;
				var coordTimes = track.features[0].properties.coordTimes;
				
				if(track.features[0].geometry.type === 'LineString') {
					track.features[0].geometry.type = 'MultiLineString'
					track.features[0].geometry.coordinates = [coords];
					track.features[0].properties.coordTimes = [coordTimes];
				}
			}

			/**
			 *
			 * Calculate accumulated distance for each coordinate.
			 * Build array of objects for the lineChart
			 * Eventually this should be done in a backend service
			 * Currently this requires a lot of browser capacity and it holds up the UI while it computes
			 *
			 */
			function addDistanceData(trackId) {
				var data = [];
				var track = vm.lookup.tracks[trackId];
				var coords = track.features[0].geometry.coordinates;
				var coordTimes = track.features[0].properties.coordTimes;
				
				/**
				 *
				 * If geojson is a single LineString, coords will be an array of all coordinates.
				 * If geojson is a MultiLineString, coords will be an array of arrays of coordinates.
				 * MultiLineStrings must be handled specially so that distances are accurate.
				 *
				 */
				if(track.features[0].geometry.type === 'LineString') {
					coords.forEach(function(c, i) {
						var distance = 0;
						if(i > 1) {
							var line = turf.lineString(coords.slice(0, i));
							distance = turf.length(line, {units: 'miles'});
						}
						data.push({
							date: new Date(coordTimes[i]),
							distance: distance,
							lat: c[1],
							long: c[0]
						});
					});
				} else if(track.features[0].geometry.type === 'MultiLineString') {
					/**
					 *
					 * Maintain a list of accumulated distance as of the end of each segment in distanceAsOfSegment.
					 * These values are added to subsequent line segment distances to account for prior distance traveled.
					 * This ensures that distance from all line segments counts towards total distance accumulation,
					 * and that distance is not counted from the end point of one segment to the start point of a new segment.
					 *
					 * Keep a running tab of all the indices at which data gaps occur in gapIndicesPerSegment
					 * Ensure segment index and coord index are recorded.
					 * gaplessCoordSegments and gaplessCoordTimeSegments will ultimately be populated with the cleaned, gapless data.
					 * Right now a "gap" is considered any two coordinates whose distance from each other is greater than 1 mile.
					 *
					 */
					var distanceAsOfSegment = [];
					var gapIndicesPerSegment = [];
					var gaplessCoordSegments = [];
					var gaplessCoordTimeSegments = [];
					coords.forEach(function(segment, ii) {
						gapIndicesPerSegment[ii] = [];
						segment.forEach(function(c, i) {
							var distance = 0;
							if(i > 0) {
								var line = turf.lineString(segment.slice(0, i+1));
								distance = turf.length(line, {units: 'miles'});
								var pointToPreviousPoint = turf.lineString(segment.slice(i-1, i+1));
								distanceFromPrevious = turf.length(pointToPreviousPoint, {units: 'miles'});
								if(distanceFromPrevious > 1.0) {
									gapIndicesPerSegment[ii].push(i);
									distance = 0;
								}
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

					/**
					 *
					 * Loop through each line segment and look at where the gaps occur.
					 * Slice new segments based on the indices of the gaps and add these to gaplessCoordSegments and gaplessCoordTimeSegments
					 *
					 */
					gapIndicesPerSegment.forEach(function(segmentGapIndices, ii) {
						if(segmentGapIndices.length === 0) {
							gaplessCoordSegments.push(coords[ii]);
							gaplessCoordTimeSegments.push(coordTimes[ii]);
						} else {
							segmentGapIndices.forEach(function(g, i) {
								var newSegment;
								var newTimeSegment;
								if(i === 0) {
									newSegment = coords[ii].slice(0, g);
									newTimeSegment = coordTimes[ii].slice(0, g);
								} else {
									newSegment = coords[ii].slice(segmentGapIndices[i-1], g);
									newTimeSegment = coordTimes[ii].slice(segmentGapIndices[i-1], g);
								}

								gaplessCoordSegments.push(newSegment);
								gaplessCoordTimeSegments.push(newTimeSegment);

								if(i === segmentGapIndices.length - 1 && g < coords[ii].length - 1) {
									restOfSegment = coords[ii].slice(g);
									restOfTimeSegment = coordTimes[ii].slice(g);
									gaplessCoordSegments.push(restOfSegment);
									gaplessCoordTimeSegments.push(restOfTimeSegment);
								} 
							});
						}
					});

					track.features[0].geometry.coordinates = gaplessCoordSegments;
					track.features[0].properties.coordTimes = gaplessCoordTimeSegments;
				}

				lineChartService.data.tracks.push(data);
				console.log("added a distance array");
				return lineChartService.data;
			}

			/**
			 *
			 * Adds a new layer on the map for drawing a new track
			 * Track layers are given unique identifiers in the form of track[NUMBER]
			 * The original geojson containing the track points is maintained in vm.lookup.tracks using the unique id
			 * Also adds a point for each line to mark the current location when hover over the line chart.
			 * Points are initialized at the track's first set of coordinates.
			 *
			 */
			function addTrackToMap(trackId) {
				var track = vm.lookup.tracks[trackId];
				var number = trackId.split("track")[1];
				var color = number <= colors.length - 1 ? colors[number] : colors[number % colors.length];
				var geometryType = track.features[0].geometry.type;
				var pointInitialCoordinates = null;

				track.color = color;
				track.visible = true;

				if(geometryType === 'LineString') {
					pointInitialCoordinates = track.features[0].geometry.coordinates[0];
				} else if(geometryType === 'MultiLineString') {
					pointInitialCoordinates = track.features[0].geometry.coordinates[0][0];
				}
				
				var line = {
					"id": trackId,
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

				if(trackId === 'track0') map.flyTo({center: pointInitialCoordinates});
				map.addLayer(line);
				map.addLayer(point);

				$scope.$apply();

				return vm.lookup.tracks;
			}

			function recenterMap(trackId) {
				var center = vm.lookup.tracks[trackId].features[0].geometry.coordinates[0][0]
				
			}
		}]
	}
});

