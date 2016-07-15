# Splunk Events

Javascript lib to create Splunk Logs via HTTP

-------
### Support

- Node
- Browser (IE8+, Firefox, Chrome, Safari and Opera)

-------
### ES6 Example

```javascript
import SplunkEvents from 'splunk-events';

let splunkEvents = new SplunkEvents();

splunkEvents.config({
  token: 'xxx', // required
});

splunkEvents.logEvent({
  user: 'tiago'
});
```

-------
### ES5 Example

```javascript
var SplunkEvents = require('splunk-events');

var splunkEvents = new SplunkEvents();

splunkEvents.config({
  token: 'xxx', // required
});

splunkEvents.logEvent({
  user: 'tiago'
});
```

-------
### API


#### config(params)
```javascript
{
  // Required. This is provided by the Splunk administrator (@caldas)
  token: 'xxxxx',
  
  // Optional. Index created in Splunk. The 'token' option already associates the index info. 
  // This option is useful when the token have multiple indexes.
  index: 'xxxxx',
  
  // A debounced function will automatically flush your events after some time
  autoFlush: true, //default
  
  // Inactive time to wait until flush events. Requires 'autoFlush' option.
  debounceTime: 2000, //default
  
  // Max time to wait until flush events. Requires 'autoFlush' option.
  debounceMaxWait: 5000 //default
  
  // If the request fail, retry to send events using the debounced flush function 
  autoRetryFlush: true, //default
  
  // VTEX's default endpoint to Splunk
  endpoint: 'http://splunkindexers.splunk.vtex.com:8088', //default
  
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

### Request example
https://www.getpostman.com/collections/671bdbe22048240fc5b5
