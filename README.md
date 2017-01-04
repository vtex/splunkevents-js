# Splunk Events

Javascript lib to create Splunk Logs via HTTP

-------
### Support

- Node
- Browser (IE8+, Firefox, Chrome, Safari and Opera)

-------
### Setup

```npm install splunk-events```

-------
### ES6 Example

```javascript
import SplunkEvents from 'splunk-events';

let splunkEvents = new SplunkEvents();

splunkEvents.config({
  token: 'YOUR_TOKEN_HERE', // required
});

splunkEvents.logEvent(
  'Critical', 
  'Info', 
  'WeaponConstruction', 
  'DeathStar'
  { username: 'vader'}
);
```

-------
### ES5 Example

```javascript
var SplunkEvents = require('splunk-events');

var splunkEvents = new SplunkEvents();

splunkEvents.config({
  token: 'YOUR_TOKEN_HERE', // required
});

splunkEvents.logEvent(
  'Critical', 
  'Info', 
  'WeaponConstruction', 
  'DeathStar'
  { username: 'vader'}
);
```

-------
### API


#### config(params)
```javascript
{
  // Required. Splunk server endpoint
  endpoint: 'YOUR_SPLUNK_ENDPOINT',

  // Required. This is provided by the Splunk administrator
  token: 'YOUR_TOKEN',
  
  // Optional. Index created in Splunk. The 'token' option already associates the index info. 
  // This option is useful when the token have multiple indexes.
  index: 'YOUR_INDEX',
 
  // Optional. Unique identifier in your system used to associate the events with the device
  host: 'YOUR_HOST',
  
  // A debounced function will automatically flush your events after some time
  autoFlush: true, //default

  // Add useful info
  injectAditionalInfo: false, //default

  // Inactive time to wait until flush events. Requires 'autoFlush' option.
  debounceTime: 2000, //default
  
  // Max time to wait until flush events. Requires 'autoFlush' option.
  debounceMaxWait: 5000 //default
  
  // If the request fail, retry to send events using the debounced flush function 
  autoRetryFlush: true, //default
  
  // Splunk's default path
  path: '/services/collector/event', //default
  
  // Important steps will be logged in the console
  debug: false, //default
  
  // Source of the logs
  source: 'splunkeventsjs', //default
}
```

#### logEvent(level, type, workflowType, workflowInstance, event)

'level' is the criticality of the event ('Critical','Important','Debug').

'type' is the type of the event ('Error','Warn','Info').

'workflowType' is an action or a flow's stage in the system.

'workflowInstance' defines what id/element is being processed/executed/created in the workflowType.

'event' is an object containing your custom data to send to Splunk. This object should be flat and the properties with 'null' or 'undefined' value will be **omitted**.

if 'injectAditionalInfo' is set to true, this function adds some default data to the event
```
- User Agent
- Browser Language
- Screen Resolution
- URI Host
- URI Path
- URI Protocol
- URI Hash
```

#### flush()

Immediately send all queued events to Splunk Server.

This is not required when using the 'autoFlush' option.


-------
### Splunk Documentation
http://dev.splunk.com/view/event-collector/SP-CAAAE6P
