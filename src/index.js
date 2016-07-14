import debounce from 'lodash/debounce';

export default class SplunkEvents {

  config(config) {
    this.events = [];

    this.token = config.token; // required
    this.index = config.index; // optional

    this.autoFlush = config.autoFlush || true;
    this.host = config.host || 'localhost';
    this.source = config.source || 'datasource';
    this.path = config.path || '/services/collector/event';
    this.sourcetype = config.sourcetype || 'log';

    this.debounceTime = config.debounceTime || 2000;
    this.debouncedFlush = debounce(this.flush, this.debounceTime);
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

    for (var i = 0; i < this.events.length; i++) {
      console.log('Splunk Event ' + i, this.token, this.events[i]);
    }

    this.events = [];
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
