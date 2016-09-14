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

splunkEvents.logEvent({
  username: 'vader'
});
```

-------
### ES5 Example

```javascript
var SplunkEvents = require('splunk-events');

var splunkEvents = new SplunkEvents();

splunkEvents.config({
  token: 'YOUR_TOKEN_HERE', // required
});

splunkEvents.logEvent({
  username: 'vader'
});
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
  
  // A debounced function will automatically flush your events after some time
  autoFlush: true, //default

  // Add useful info
  injectAditionalInfo: true, //default

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
}
```

#### logEvent(event)

The 'event' argument expects your custom data to send to Splunk Server. 'Event' must not be null.

This function add events to a queue with some default data
```
- Timestamp
- User Agent
- Session ID
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
