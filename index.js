(function(window, document) {
  var YourTracker = function() {
    this.queue = [];
    this.config = {
      clientId: null,
      endpoint: 'https://api.yourcompany.com/track',
      batchSize: 10,
      flushInterval: 10000
    };
    this.visitorId = localStorage.getItem('yt_visitorId') || this.generateUUID();
    localStorage.setItem('yt_visitorId', this.visitorId);
  };

  YourTracker.prototype = {
    init: function(clientId, options) {
      this.config.clientId = clientId;
      Object.assign(this.config, options);
      this.processQueue();
      this.startTracking();
    },

    generateUUID: function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },

    track: function(eventName, eventData) {
      this.addToQueue('track', eventName, eventData);
    },

    identify: function(userId, userProperties) {
      this.visitorId = userId;
      localStorage.setItem('yt_visitorId', this.visitorId);
      this.addToQueue('identify', userId, userProperties);
    },

    addToQueue: function(action, ...args) {
      this.queue.push({action: action, args: args, timestamp: new Date().toISOString()});
      if (this.queue.length >= this.config.batchSize) {
        this.flush();
      }
    },

    flush: function() {
      if (this.queue.length > 0) {
        fetch(this.config.endpoint, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            clientId: this.config.clientId,
            visitorId: this.visitorId,
            events: this.queue
          }),
        }).catch(console.error);
        this.queue = [];
      }
    },

    startTracking: function() {
      this.trackPageView();
      this.trackClicks();
      this.trackFormSubmissions();
      this.trackUserProperties();
      window.addEventListener('popstate', this.trackPageView.bind(this));
      setInterval(this.flush.bind(this), this.config.flushInterval);
      window.addEventListener('beforeunload', this.flush.bind(this));
    },

    trackPageView: function() {
      this.track('pageview', {
        url: window.location.href,
        referrer: document.referrer,
        title: document.title
      });
    },

    trackClicks: function() {
      document.addEventListener('click', (e) => {
        let target = e.target;
        this.track('click', {
          tagName: target.tagName,
          id: target.id,
          className: target.className,
          textContent: target.textContent.slice(0, 50),
          href: target.href || null
        });
      });
    },

    trackFormSubmissions: function() {
      document.addEventListener('submit', (e) => {
        this.track('form_submission', {
          formId: e.target.id,
          formAction: e.target.action
        });
      });
    },

    trackUserProperties: function() {
      this.track('user_properties', {
        userAgent: navigator.userAgent,
        language: navigator.language,
        screenSize: `${window.screen.width}x${window.screen.height}`,
        viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        timezoneOffset: new Date().getTimezoneOffset()
      });
    },

    processQueue: function() {
      var globalQueue = window.ytTracker.q || [];
      for (var i = 0; i < globalQueue.length; i++) {
        this[globalQueue[i][0]].apply(this, globalQueue[i].slice(1));
      }
    }
  };

  var instance = new YourTracker();
  
  // Replace the global ytTracker function with our instance methods
  window.ytTracker = function() {
    return instance[arguments[0]].apply(instance, Array.prototype.slice.call(arguments, 1));
  };

  // Also expose the instance directly for advanced usage
  window.YourTracker = instance;
})(window, document);