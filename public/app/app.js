var app = angular.module('wigs', ['ui.router', 'ngFileUpload']);

app.config(function($stateProvider, $urlRouterProvider) {

    $urlRouterProvider.otherwise('/');

    $stateProvider
        .state('geography', {
            url: '/',
            templateUrl: 'public/app/templates/geography.html',
            controller: 'geographyController',
            controllerAs: 'gc'
        });
});