# Splunk Events

Javascript lib to create Splunk Logs via HTTP

-------
### Support

- Node (with axios as dependency)
- Browser (IE8+, Firefox, Chrome, Safari and Opera)

-------
### Setup

```npm install splunk-events```

-------
### ES6 Example

```javascript
import SplunkEvents from 'splunk-events';

const splunkEvents = new SplunkEvents();

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

  // Fetcher to do Splunk Events requests
  request: function with axios signature that uses global Fetch API by default // default (see more details below)

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

'account' is the accountName (e.g. 'dreamstore','gatewayqa','instoreqa').

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

#### Working on Node and old browsers

By default this lib doesn't have any dependencies for the newer browsers (it tries to use Fetch API)

But to make it work on old browsers and Node you must use axios (0.13+) as a dependency by installing it (```npm install --save axios```) and setting it on Splunk events config:

```javascript
import SplunkEvents from 'splunk-events';
import axios from 'axios';

const splunkEvents = new SplunkEvents();

splunkEvents.config({
  token: 'YOUR_TOKEN_HERE', // required
  request: axios, // this make it work on old browsers and node environments
});
```

You can also write your own fetcher to choose your own dependencies for doing the requests (see the next section).

#### Write your own fetcher

Just like you can pass axios as a request config (see section above), you can write your own fetcher by just following the same signature that axios use (see axios API documentation: https://github.com/mzabriskie/axios#axios-api).

The following example is how to make the node-fetch (https://github.com/bitinn/node-fetch) module work with axios signature:

```javascript
import SplunkEvents from 'splunk-events';
import fetch from 'node-fetch';

function nodeFetchRequest(context) {
  return fetch(context.url, {
    ...context,
    body: context.data
  })
  .then((response) => {
    if (context.responseType === 'json') {
      return response.json();
    }
    return response;
  });
}

const splunkEvents = new SplunkEvents();

splunkEvents.config({
  token: 'YOUR_TOKEN_HERE', // required
  request: nodeFetchRequest,
});
```

-------
### Splunk Documentation
http://dev.splunk.com/view/event-collector/SP-CAAAE6P
