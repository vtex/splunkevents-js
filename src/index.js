import debounce from 'lodash/debounce';
import axios from 'axios';

export default class SplunkEvents {

  config(config) {
    this.events = [];

    this.token = config.token; // required
    this.index = config.index; // optional

    this.autoFlush = config.autoFlush || true;
    this.endpoint = config.endpoint || 'http://splunkindexers.splunk.vtex.com:8088';
    this.source = config.source || 'datasource';
    this.path = config.path || '/services/collector/event';
    this.sourcetype = config.sourcetype || 'log';
    this.debug = config.debug || false;
    this.debounceTime = config.debounceTime || 2000;
    this.debouncedFlush = debounce(this.flush, this.debounceTime);

    this.axiosInstance = axios.create({
      baseURL: `${this.endpoint}`,
      headers: {
        'Authorization': `Splunk ${this.token}`
      }
    });
  }

  logEvent(event) {
    this.validateEvent(event);

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

  flush() {
    this.validateConfig();

    if (this.debug) {
      console.log(`sending ${this.events.length} to splunk`);
    }

    axios.post(this.path, this.events).then((response) => {
      if (this.debug) {
        console.log(`${this.events.length} events successfuly sent to splunk`);
      }
      this.events = [];
    }).catch((e) => {
      if (this.debug) {
        console.warn('Error sending events to splunk. Retrying in 5 seconds.');
      }
      this.debouncedFlush();
    });
  }

  validateConfig() {
    if (this.token === null) {
      throw 'Token must not be null';
    }

    if (this.token === undefined) {
      throw 'Token must not be undefined';
    }
  }
}
