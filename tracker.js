(function(window, document) {
  var YourTracker = function() {
    this.queue = [];
    this.config = {
      clientId: null,
      endpoint: 'http://localhost:4000/track',
      batchSize: 10,
      flushInterval: 10000, // 5 seconds for easier debugging
      debug: true  // Enable debug mode by default
    };

    this.visitorId = localStorage.getItem('yt_visitorId') || this.generateUUID();
    localStorage.setItem('yt_visitorId', this.visitorId);
    this.flushIntervalId = null;  // Add this line
    this.initialized = false;
    this.debug('YourTracker instantiated');
  };

  YourTracker.prototype = {
    init: function(clientId, options) {
      console.log('--------------------------------------- INIT ---------------------------------------')
      if (this.initialized) {
        this.debug('Tracker already initialized');
        return;
      }

      try {
        this.debug('Initializing with clientId:', clientId);
        this.config.clientId = clientId;
        if (options && typeof options === 'object') {
          Object.assign(this.config, options);
        }
        this.processQueue();
        this.startTracking();
        this.debug('Initialization complete');
      } catch (error) {
        console.error('Error during initialization:', error);
      }
    },

    debug: function(...args) {
      if (this.config.debug) {
        console.log('YourTracker:', ...args);
      }
    },

    generateUUID: function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },

    track: function(eventName, eventData) {
      this.debug('Tracking event:', eventName, eventData);
      this.addToQueue({
        action: 'track',
        eventName,
        eventData
      });
    },

    identify: function(userId, userProperties) {
      this.debug('Identifying user:', userId, userProperties);
      this.visitorId = userId;
      localStorage.setItem('yt_visitorId', this.visitorId);

      console.log('--------------------------------------- IDENTIFY ---------------------------------------')

      this.addToQueue({
        action: 'identify',
        eventName: 'user_identified',
        eventData: {},
        userId,
        userProperties
      });
    },

    addToQueue: function({
      action,
      eventName,
      eventData,
      userId,
      userProperties,
      ...args
    }) {
      this.debug('Adding to queue:', action, args);
      this.queue.push({
        action: action,
        name: eventName,
        data: eventData,
        userId,
        userProperties,
        timestamp: new Date().toISOString()
      });

      if (this.queue.length >= this.config.batchSize) {
        this.flush();
      }
    },

    collectClientInfo: function() {
      return {
        userAgent: navigator.userAgent,
        language: navigator.language,
        screenSize: `${window.screen.width}x${window.screen.height}`,
        viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        timezoneOffset: new Date().getTimezoneOffset(),
        cookiesEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        platform: navigator.platform,
        referrer: document.referrer,
        url: window.location.href
      };
    },

    flush: function() {
      if (this.queue.length > 0) {
        this.debug('Attempting to flush queue', this.queue);
        this.debug('Flushing to endpoint:', this.config.endpoint);

        const clientInfo = this.collectClientInfo();
        
        fetch(this.config.endpoint, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            clientId: this.config.clientId,
            visitorId: this.visitorId,
            events: this.queue,
            clientInfo: clientInfo,
          }),
        }).then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }

          return response.json();
        }).then(data => {
          this.debug('Flush successful, server responded:', data);
          this.queue = [];
        }).catch(error => {
          this.debug('Flush error:', error);
          // Optionally, implement retry logic here
        });
      } else {
        this.debug('Flush called but queue is empty');
      }
    },

    startTracking: function() {
      this.debug('--------------------------------------- Starting automatic tracking');
      this.trackPageView();
      this.trackClicks();
      this.trackFormSubmissions();
      this.trackUserProperties();
      window.addEventListener('popstate', this.trackPageView.bind(this));

      // Clear any existing interval
      if (this.flushIntervalId) {
        clearInterval(this.flushIntervalId);
      }

      this.debug('Setting flush interval');

      // Set up the new interval
      this.flushIntervalId = setInterval(() => {
        this.debug('Automated flush triggered');
        this.flush();
      }, this.config.flushInterval);

      this.debug('Flush interval', this.flushIntervalId);

      this.debug('Automated flushing set up with interval:', this.config.flushInterval);

      window.addEventListener('beforeunload', () => {
        this.debug('Page is about to unload, flushing...');
        this.flush();
      });
    },

    trackPageView: function() {
      this.debug('Tracking page view');
      this.track('page_view', {
        url: window.location.href,
        path: window.location.pathname,
        referrer: document.referrer,
        title: document.title
      });
    },

    trackClicks: function() {
      this.debug('Setting up click tracking');
      document.addEventListener('click', (e) => {
        let target = e.target;
        this.track('click', {
          element: {
            tagName: target.tagName.toLowerCase(),
            id: target.id || null,
            className: target.className || null,
            textContent: target.textContent ? target.textContent.trim().slice(0, 50) : null,
          },
          page: {
            url: window.location.href,
            path: window.location.pathname,
            referrer: document.referrer,
            title: document.title
          }
        });
      });
    },

    trackFormSubmissions: function() {
      this.debug('Setting up form submission tracking');
      document.addEventListener('submit', (e) => {
        const form = e.target;
        this.track('form_submission', {
          form: {
            id: form.id || null,
            action: form.action || null,
            method: form.method || null,
            fields: Array.from(form.elements).map(element => ({
              name: element.name || null,
              type: element.type || null,
              value: element.type === 'password' ? '[REDACTED]' : element.value || null
            }))
          },
          page: {
            url: window.location.href,
            path: window.location.pathname
          }
        });
      });
    },

    trackUserProperties: function() {
      this.debug('Tracking user properties');
      this.track('user_properties', {
        browser: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          cookiesEnabled: navigator.cookieEnabled,
          doNotTrack: navigator.doNotTrack,
          platform: navigator.platform
        },
        screen: {
          width: window.screen.width,
          height: window.screen.height,
          colorDepth: window.screen.colorDepth,
          pixelRatio: window.devicePixelRatio
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        time: {
          timezoneOffset: new Date().getTimezoneOffset(),
          timestamp: new Date().toISOString()
        }
      });

      /**
       * // Then, fetch the country information
        fetch('https://ipapi.co/json/')
          .then(response => response.json())
          .then(data => {
            const locationProperties = {
              country: data.country_name,
              countryCode: data.country_code,
              region: data.region,
              city: data.city,
              latitude: data.latitude,
              longitude: data.longitude,
              ip: data.ip
            };

            // Track the location properties separately
            this.track('user_location', locationProperties);
          })
          .catch(error => {
            this.debug('Error fetching location data:', error);
          });
       */
    },

    processQueue: function() {
      this.debug('Processing queue');
      var globalQueue = window.ytTracker.q || [];
      for (var i = 0; i < globalQueue.length; i++) {
        this.debug('Processing queued item:', globalQueue[i]);
        this[globalQueue[i][0]].apply(this, globalQueue[i].slice(1));
      }
      // Clear the queue
      window.ytTracker.q = [];
      this.debug('Queue processing complete');
    }
  };

  var instance = new YourTracker();
  
  // Replace the global ytTracker function with our instance methods
  window.ytTracker = function() {
    instance.debug('ytTracker called with arguments:', arguments);
    if (instance[arguments[0]]) {
      return instance[arguments[0]].apply(instance, Array.prototype.slice.call(arguments, 1));
    } else {
      console.warn("Method " + arguments[0] + " does not exist on YourTracker");
    }
  };

  // Process any queued commands
  instance.processQueue();

  // Also expose the instance directly for advanced usage
  window.YourTracker = instance;

  instance.debug('YourTracker setup complete');
})(window, document);

console.log('Tracker script loaded');