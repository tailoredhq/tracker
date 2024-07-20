(function(window, document) {
  var YourTracker = function() {
    this.queue = [];
    this.config = {
      clientId: null,
      endpoint: 'http://localhost:4000/track',
      batchSize: 10,
      flushInterval: 10000, // 5 seconds for easier debugging
      debug: true,  // Enable debug mode by default

      // cookies
      visitorIdCookie: 'yt_visitor_id',
      userIdCookie: 'yt_user_id',
      localStorageKeyPrefix: 'yt_',
      cookieExpiry: 365 * 24 * 60 * 60 * 1000, // 1 year in milliseconds
    };

    this.visitorId = localStorage.getItem('yt_visitorId') || this.generateUUID();
    localStorage.setItem('yt_visitorId', this.visitorId);

    const test = this.generateUUID();
    console.log('--->', test)
    
    this.flushIntervalId = null;  // Add this line
    this.initialized = false;
    this.debug('YourTracker instantiated');
  };

  YourTracker.prototype = {
    init: function(clientId, options) {
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

    /**
     * Setting / Getting visitorId and userId
     */
    getVisitorId: function() {
      // var visitorId = this.getCookie(this.config.visitorIdCookie) || this.getLocalStorage(this.config.localStorageKeyPrefix + 'visitor_id');
      console.log("HERE", visitorId)
      // if (!visitorId) {
      //   visitorId = this.generateUUID();
      //   this.setVisitorId(visitorId);
      // }
      // return visitorId;
    },
    getUserId: function() {
      return this.getCookie(this.config.userIdCookie) || this.getLocalStorage(this.config.localStorageKeyPrefix + 'user_id') || null;
    },
    setVisitorId: function() {
      this.setCookie(this.config.visitorIdCookie, visitorId, this.config.cookieExpiry);
      this.setLocalStorage(this.config.localStorageKeyPrefix + 'visitor_id', visitorId);
    },
    setUserId: function() {
      if (userId) {
        this.setCookie(this.config.userIdCookie, userId, this.config.cookieExpiry);
        this.setLocalStorage(this.config.localStorageKeyPrefix + 'user_id', userId);
      } else {
        this.deleteCookie(this.config.userIdCookie);
        this.removeLocalStorage(this.config.localStorageKeyPrefix + 'user_id');
      }
      this.userId = userId;
    },

    // Cookie and LocalStorage helpers
    setCookie: function(name, value, expiryMs) {
      var date = new Date();
      date.setTime(date.getTime() + expiryMs);
      var expires = "expires=" + date.toUTCString();
      document.cookie = name + "=" + value + ";" + expires + ";path=/;SameSite=Lax";
    },
  
    getCookie: function(name) {
      // Add the '=' to the name to ensure we match the full cookie name
      name = name + "=";
      // Split the cookie string into an array of individual cookies
      var decodedCookie = decodeURIComponent(document.cookie);
      var cookieArray = decodedCookie.split(';');
      
      // Loop through the array to find our specific cookie
      for (var i = 0; i < cookieArray.length; i++) {
        var cookie = cookieArray[i];
        // Remove any leading spaces
        while (cookie.charAt(0) == ' ') {
          cookie = cookie.substring(1);
        }
        // If we find the cookie name at the start of the string, return its value
        if (cookie.indexOf(name) == 0) {
          return cookie.substring(name.length, cookie.length);
        }
      }
      // Return null if the cookie wasn't found
      return null;
    },
  
    deleteCookie: function(name) {
      document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    },

    setLocalStorage: function(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.warn('Local storage is not available:', e);
      }
    },
  
    getLocalStorage: function(key) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.warn('Local storage is not available:', e);
        return null;
      }
    },
  
    removeLocalStorage: function(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn('Local storage is not available:', e);
      }
    },

    // Actually tracking functions
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

      // store current visitorId to send to server
      visitorId = this.visitorId

      // update visitor id with userId
      this.visitorId = userId;
      localStorage.setItem('yt_visitorId', this.visitorId);

      //  send event to server directly on identify, don't queue
      fetch(this.config.endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          clientId: this.config.clientId,
          visitorId,
          events: [{
            action: 'identify',
            name: 'user_identified',
            data: {},
            userId: `${userId}`,
            userProperties,
            timestamp: new Date().toISOString()
          }],
          clientInfo: this.collectClientInfo()
        }),
      }).then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        return response.json();
      }).catch(error => {
        this.debug('Identify network error:', error);
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
        console.log('---------------------------------------')
        console.log(target)
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

      // Then, fetch the country information
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
        }).catch(error => {
          this.debug('Error fetching location data:', error);
        });
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