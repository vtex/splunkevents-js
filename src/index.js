import debounce from 'lodash/debounce';
import extend from 'lodash/extend';
import clone from 'lodash/clone';
import concat from 'lodash/concat';
import axios from 'axios';

export default class SplunkEvents {

  config(config) {
    this.events = [];
    this.pendingEvents = [];
    this.isSendingEvents = false;

    this.endpoint = config.endpoint; // required
    this.token = config.token; // required

    this.index = config.index; // optional
    this.autoFlush = config.autoFlush || true;
    this.autoRetryFlush = config.autoRetryFlush || true;
    this.source = config.source || 'datasource';
    this.path = config.path || '/services/collector/event';
    this.sourcetype = config.sourcetype || 'log';
    this.debug = config.debug || false;
    this.debounceTime = config.debounceTime || 2000;
    this.debounceMaxWait = config.debounceMaxWait || 5000;
    this.debouncedFlush = debounce(this.flush, this.debounceTime, {}, false, this.debounceMaxWait);

    this.axiosInstance = axios.create({
      baseURL: `${this.endpoint}`,
      headers: {
        'Authorization': `Splunk ${this.token}`
      },
      responseType: 'json'
    });
  }

  logEvent(event) {
    this.validateEvent(event);
    event = extend(event, (typeof navigator !== 'undefined') ? this.getAdditionalInfo() : {});

    let data = {
      time: new Date().getTime(),
      host: this.host,
      source: this.source,
      event: event
    };

    this.events.push(data);

    if (this.autoFlush) {
      this.debouncedFlush();
    }
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
    return {
      userAgent: navigator.userAgent,
      language: navigator.browserLanguage || navigator.language,
      platform: navigator.platform,
      screenWidth: window.screen.availWidth,
      screenHeight: window.screen.availHeight,
      host: window.location.host,
      path: window.location.pathname,
      protocol: window.location.protocol,
      hash: window.location.hash
    };
  }

  flush() {
    if (this.isSendingEvents) {
      this.debouncedFlush();
      return;
    }

    this.validateConfig();

    this.pendingEvents = clone(this.events);
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
      this.events = concat(this.events, this.pendingEvents);
      this.pendingEvents = [];
      this.isSendingEvents = false;

      if (this.autoRetryFlush) {
        if (this.debug) {
          console.warn('Error sending events to splunk. Retrying in 5 seconds.');
        }
        this.debouncedFlush();
      } else {
        if (this.debug) {
          console.warn('Error sending events to splunk.');
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
