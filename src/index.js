// debounce helper

function debounce(func, wait, immediate) {
  var timeout, args, context, timestamp, result;
  if (wait == null) wait = 100;

  function later() {
    var last = Date.now() - timestamp;

    if (last < wait && last >= 0) {
      timeout = setTimeout(later, wait - last);
    } else {
      timeout = null;
      if (!immediate) {
        result = func.apply(context, args);
        context = args = null;
      }
    }
  };

  const debounced = function () {
    context = this;
    args = arguments;
    timestamp = Date.now();
    const callNow = immediate && !timeout;
    if (!timeout) timeout = setTimeout(later, wait);
    if (callNow) {
      result = func.apply(context, args);
      context = args = null;
    }

    return result;
  };

  debounced.clear = function () {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}

// fetch helper

function fetchRequest(context) {
  if (typeof window !== 'undefined' && typeof window.fetch !== 'function' ||
      typeof global !== 'undefined' && typeof global.fetch !== 'function') {
    console.log('Error, using fetchRequest without fetch object');
    return null;
  }

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

// splunk class

export default class SplunkEvents {

  config(config) {
    this.events = [];
    this.pendingEvents = [];
    this.isSendingEvents = false;
    this.endpoint = config.endpoint; // required
    this.token = config.token; // required
    this.injectAditionalInfo = config.injectAditionalInfo !== undefined ? config.injectAditionalInfo : false;
    this.autoFlush = config.autoFlush !== undefined ? config.autoFlush : true;
    this.autoRetryFlush = config.autoRetryFlush !== undefined ? config.autoRetryFlush : true;
    this.source = config.source !== undefined ? config.source : 'splunkeventsjs';
    this.path = config.path !== undefined ? config.path : '/services/collector/event';
    this.host = config.host !== undefined ? config.host : '-';
    this.debug = config.debug !== undefined ? config.debug : false;
    this.debounceTime = config.debounceTime !== undefined ? config.debounceTime : 2000;
    this.debouncedFlush = debounce(this.flush, this.debounceTime);
    this.request = config.request !== undefined ? config.request : fetchRequest;
    this.headers = {
      'Authorization': `Splunk ${this.token}`
    };
  }

  logEvent(level, type, workflowType, workflowInstance, event, account) {
    this.validateEvent(event);
    let parsedEvent = `${level},${type},${workflowType},${workflowInstance},${account} `;
    parsedEvent += this.parseEventData(event);

    if (this.injectAditionalInfo) {
      parsedEvent += this.getAdditionalInfo();
    }

    let data = {
      sourcetype: this.source,
      host: this.host,
      event: parsedEvent
    };

    this.events.push(data);

    if (this.autoFlush) {
      this.debouncedFlush();
    }
  }

  parseEventData(event) {
    let parsedEvent = '';
    for (var key in event) {
      if (event.hasOwnProperty(key) && event[key] != null) {
        switch (typeof event[key]) {
          case 'string':
            parsedEvent += `${key}="${event[key].replace(/\"/g, '')}" `;
            break;
          case 'boolean':
          case 'number':
            parsedEvent += `${key}=${event[key]} `;
            break;
          default:
            throw 'Event property must be string, number or boolean';
        }
      }
    }
    return parsedEvent;
  }

  validateEvent(event) {
    if (event === null) {
      throw 'Event must not be null';
    }

    if (event === undefined) {
      throw 'Event must not be undefined';
    }

    if (typeof event !== 'object') {
      throw 'Event must be an object';
    }
  }

  getAdditionalInfo() {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') {
      return '';
    }
    let screen = window.screen ? window.screen : {};
    let location = window.location ? window.location : {};
    return `additional_info="${navigator.userAgent.replace(/\,/g, ';')},` +
    `${navigator.browserLanguage || navigator.language},` +
    `${navigator.platform},${screen.availWidth || '-'},${screen.availHeight || '-'},${location.hostname},` +
    `${location.pathname},${location.protocol.replace(':', '')},${location.hash || '-'}"`;
  }

  flush() {
    if (this.isSendingEvents) {
      this.debouncedFlush();
      return;
    }

    this.validateConfig();

    this.pendingEvents = [].concat(this.events);
    this.events = [];
    this.isSendingEvents = true;

    if (this.debug) {
      console.log(`sending ${this.pendingEvents.length} events to splunk`);
    }

    let splunkBatchedFormattedEvents = this.formatEventsForSplunkBatch(this.pendingEvents);

    this.request({
      url: `${this.endpoint}${this.path}`,
      method: 'POST',
      data: splunkBatchedFormattedEvents,
      headers: this.headers,
      responseType: 'json'
    }).then((response) => {
      if (this.debug) {
        console.log(`${this.pendingEvents.length} events successfuly sent to splunk`);
      }
      this.pendingEvents = [];
      this.isSendingEvents = false;
    }).catch((e) => {
      this.events = this.events.concat(this.pendingEvents);
      this.pendingEvents = [];
      this.isSendingEvents = false;

      if (this.autoRetryFlush) {
        if (this.debug) {
          console.warn('Error sending events to splunk. Retrying in 5 seconds.', e);
        }
        this.debouncedFlush();
      } else {
        if (this.debug) {
          console.warn('Error sending events to splunk.', e);
        }
      }
    });
  }

  formatEventsForSplunkBatch(events) {
    let splunkBatchedFormattedEvents = '';

    for (var i = 0; i < events.length; i++) {
      splunkBatchedFormattedEvents += '\n' + JSON.stringify(events[i]) + '\n';
    }

    return splunkBatchedFormattedEvents;
  }

  validateConfig() {
    if (this.token === null) {
      throw 'Token must not be null';
    }

    if (this.token === undefined) {
      throw 'Token must not be undefined';
    }

    if (this.endpoint === null) {
      throw 'endpoint must not be null';
    }

    if (this.endpoint === undefined) {
      throw 'endpoint must not be undefined';
    }
  }
}
