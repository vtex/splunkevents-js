import debounce from 'debounce';
import axios from 'axios';

export default class SplunkEvents {

  config(config) {
    this.events = [];
    this.pendingEvents = [];
    this.isSendingEvents = false;
    this.endpoint = config.endpoint; // required
    this.token = config.token; // required
    this.account = config.account; // optional
    this.injectAditionalInfo = config.injectAditionalInfo !== undefined ? config.injectAditionalInfo : false;
    this.autoFlush = config.autoFlush !== undefined ? config.autoFlush : true;
    this.autoRetryFlush = config.autoRetryFlush !== undefined ? config.autoRetryFlush : true;
    this.source = 'splunkeventsjs';
    this.path = config.path !== undefined ? config.path : '/services/collector/event';
    this.debug = config.debug !== undefined ? config.debug : false;
    this.debounceTime = config.debounceTime !== undefined ? config.debounceTime : 2000;
    this.debouncedFlush = debounce(this.flush, this.debounceTime);

    this.axiosInstance = axios.create({
      baseURL: `${this.endpoint}`,
      headers: {
        'Authorization': `Splunk ${this.token}`
      },
      responseType: 'json'
    });
  }

  logEvent(host, level, type, workflowType, workflowInstance, event) {
    this.validateEvent(event);
    let parsedEvent = `${level},${type},${workflowType},${workflowInstance} `;
    parsedEvent += this.parseEventData(event);

    if (this.injectAditionalInfo) {
      parsedEvent += this.getAdditionalInfo();
    }

    let data = {
      sourcetype: this.source,
      host: host,
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
      if (event.hasOwnProperty(key)) {
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
    return `additional_info=\ "${navigator.userAgent}","` +
    `${navigator.browserLanguage || navigator.language}","${navigator.platform}",` +
    `"${screen.availWidth}","${screen.availHeight}","${location.pathname}", ` +
    `"${location.protocol}","${location.hash}"`;
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

    this.axiosInstance.post(this.path, splunkBatchedFormattedEvents).then((response) => {
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
