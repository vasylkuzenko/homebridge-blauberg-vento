# homebridge-udp-multiswitch
Simple UDP switches for Homebridge - stateful and radio-button/multi-switch switches

*Forked from homebridge-http-homebridge

_________________________________________
#### Creating and maintaining Homebridge plugins consume a lot of time and effort, if you would like to share your appreciation, feel free to "Star" or donate. 

<a target="blank" href="https://www.paypal.me/nitaybz"><img src="https://img.shields.io/badge/Donate-PayPal-blue.svg"/></a>
<a target="blank" href="https://blockchain.info/payment_request?address=18uuUZ5GaMFoRH5TrQFJATQgqrpXCtqZRQ"><img src="https://img.shields.io/badge/Donate-Bitcoin-green.svg"/></a>

[Click here](https://github.com/nitaybz?utf8=%E2%9C%93&tab=repositories&q=homebridge) to review more of my plugins.
_________________________________________

## Switch Services

### Switch (standard on/off)
Meant to be used as a standard on/off switch. Light, projector, fan, etc.

```
{
        "accessory": "UdpMultiswitch",
        "switch_type": "Switch",
        "name": "My Projector",
        "host": "192.168.0.X",
        "port": 80,
        "on_payload": "[YOUR_UDP_ON_PAYLOAD]",
        "off_payload": "[YOUR_UDP_OFF_PAYLOAD]"
}
```

### Multiswitch (radio buttons)
Meant to be used as a switcher, where only one device is ever on.
Automaticaly set power state as off for the other devices.

```
{
    "accessory": "UdpMultiswitch",
    "switch_type": "Multiswitch",
    "name": "My Multiswitch",
    "host": "192.168.0.X",
    "port": 80,
    "multiswitch": [
                { "name": "Apple TV Mode", "payload" : "43" },
                { "name": "PC Mode", "payload" : "42786sdf787" },
                { "name": "Android", "payload" : "l1479461871215" },
            ]
}
```

## Configuration Params

|             Parameter            |                       Description                       | Required |
| -------------------------------- | ------------------------------------------------------- |:--------:|
| `name`                           | name of the accessory                                   |          |
| `switch_type`                    | `Switch` or `Multiswitch`                               |     ✓    |
| `host`                           | endpoint for whatever is receiving these requests       |     ✓    |
| `port`                           | 80 (default)                                            |          |
| `on_payload` (only Switch)       | payload for the on state                                |     ✓    |
| `off_payload` (only Switch)      | payload for the off state                               |     ✓    |
| `multiswitch` (only Multiswitch) | list of inputs for the Multiswitch - order is respected |     ✓    |

## Help

  - Make sure specify a port in the if necessary. (i.e. `"port" : "80"`)

## Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install homebridge-http using: `npm install -g homebridge-udp-multiswitch`
3. Update your config file
