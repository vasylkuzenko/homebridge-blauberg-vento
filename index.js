'use strict';

var Service;
var Characteristic;
var udp = require('./udp');

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory('homebridge-blauberg-vento', 'BlaubergVento', UdpMultiswitch);
};

function UdpMultiswitch(log, config) {
    this.log = log;

    this.name            = config.name || 'Blauberg Vento';
    this.host            = config.host;
    this.port            = config.port || 4000;

    this.onPayload      = config.on_payload;
    this.offPayload     = config.off_payload;


}

UdpMultiswitch.prototype = {

    udpRequest: function(host, port, payload, callback) {
        udp(host, port, payload, function (err) {
            callback(err);
        });
    },

    setPowerState: function(targetService, powerState, callback, context) {
        var funcContext = 'fromSetPowerState';
        var payload;

        // Callback safety
        if (context == funcContext) {
            if (callback) {
                callback();
            }

            return;
        }


        payload  = powerState ? this.onPayload  : this.offPayload;
               

        this.udpRequest(this.host, this.port, payload, function(error) {
            if (error) {
                this.log.error('setPowerState failed: ' + error.message);
                this.log('response: ' + response + '\nbody: ' + responseBody);
            
                callback(error);
            } else {
                this.log.info('==> ' + (powerState ? "On" : "Off"));
            }
            callback();
        }.bind(this));
    },

    identify: function (callback) {
        this.log('Identify me Senpai!');
        callback();
    },

    getServices: function () {
        this.services = [];

        var informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Manufacturer, 'Blauberg')
            .setCharacteristic(Characteristic.Model, 'Vento Expert');
        this.services.push(informationService);

        var filterService =  new Service.FilterMaintenance(this.name);
        filterService
            .getCharacteristic(Characteristic.FilterChangeIndication)
            .on('get', function(){

            })
        ;
        this.services.push(filterService);

        var switchService = new Service.Switch(this.name);
        switchService
            .getCharacteristic(Characteristic.On)//Characteristic.CurrentAirPurifierState
           // .on('get', this.setPowerState.bind(this, switchService))
            .on('set', this.setPowerState.bind(this, switchService))
        ;

        this.services.push(switchService);

     
        
        return this.services;
    }
};
