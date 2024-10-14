(function(window, document) {
   // Persistence module
   var Persistence = function(config) {
    this.config = {
      visitorIdCookieKey: 'yt_visitor_id',
      userIdCookieKey: 'yt_user_id',
      visitorIdLocalStorageKey: 'yt_visitor_id',
      userIdLocalStorageKey: 'yt_user_id',
      localStorageKeyPrefix: 'yt_',
      cookieExpiry: 365 * 24 * 60 * 60 * 1000, // 1 year in milliseconds
    };
    Object.assign(this.config, config);
  };

  Persistence.prototype = {
    getVisitorId: function() {
      return this.getCookie(this.config.visitorIdCookieKey) || 
             this.getLocalStorage(this.config.visitorIdLocalStorageKey);
    },

    getUserId: function() {
      return this.getCookie(this.config.userIdCookieKey) || 
             this.getLocalStorage(this.config.userIdLocalStorageKey);
    },

    setVisitorId: function(visitorId) {
      this.setCookie(this.config.visitorIdCookieKey, visitorId, this.config.cookieExpiry);
      this.setLocalStorage(this.config.visitorIdLocalStorageKey, visitorId);
    },

    setUserId: function(userId) {
      if (userId) {
        this.setCookie(this.config.userIdCookieKey, userId, this.config.cookieExpiry);
        this.setLocalStorage(this.config.userIdLocalStorageKey, userId);
      } else {
        this.deleteCookie(this.config.userIdCookieKey);
        this.removeLocalStorage(this.config.userIdLocalStorageKey);
      }
    },

    setCookie: function(name, value, expiryMs) {
      var date = new Date();
      date.setTime(date.getTime() + expiryMs);
      var expires = "expires=" + date.toUTCString();
      document.cookie = name + "=" + value + ";" + expires + ";path=/;SameSite=Lax";
    },

    getCookie: function(name) {
      name = name + "=";
      var decodedCookie = decodeURIComponent(document.cookie);
      var cookieArray = decodedCookie.split(';');
      
      for (var i = 0; i < cookieArray.length; i++) {
        var cookie = cookieArray[i];
        while (cookie.charAt(0) == ' ') {
          cookie = cookie.substring(1);
        }
        if (cookie.indexOf(name) == 0) {
          return cookie.substring(name.length, cookie.length);
        }
      }
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
    }
  };

  var YourTracker = function() {
    this.queue = [];
    this.config = {
      clientId: null,
      // endpoint: 'http://localhost:4000/track',
      endpoint: 'https://tracker-api.socialkaat.com/track',
      batchSize: 10,
      flushInterval: 10000, // 5 seconds for easier debugging
      debug: false,  // Enable debug mode by default
    };

    this.persistence = new Persistence(this.config);
    this.visitorId = this.persistence.getVisitorId() || this.generateUUID();
    this.persistence.setVisitorId(this.visitorId);
    
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

    getVisitorId: function() {
      return this.persistence.getVisitorId();
    },

    getUserId: function() {
      return this.persistence.getUserId();
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
      visitorId = this.getVisitorId()
      this.persistence.setUserId(userId);

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
        userId: userId || this.getUserId() || null,
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
        var target = e.target;
        // Get the clicked element and its ancestors
        let elementPath = this.getElementPath(target);
        
        // Get surrounding text
        let surroundingText = this.getSurroundingText(target);

        var textContent = target.textContent ? target.textContent.trim().slice(0, 500) : null;
        if (!textContent && target.value) {
          textContent = target.value;
        }

        // console.log('---------------------------------------')
        // console.log('TEXT CONTENT', textContent)
        // console.log('SURROUNDING TEXT', surroundingText)

        this.track('click', {
          element: {
            tagName: target.tagName.toLowerCase(),
            id: target.id || null,
            className: target.className || null,
            textContent,
            surroundingText
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
    },

    getElementPath: function(element) {
      let path = [];
      while (element && element.nodeType === Node.ELEMENT_NODE) {
        let selector = element.nodeName.toLowerCase();
        if (element.id) {
          selector += '#' + element.id;
        } else {
          let sibling = element;
          let siblingIndex = 1;
          while (sibling = sibling.previousElementSibling) {
            if (sibling.nodeName.toLowerCase() == selector) siblingIndex++;
          }
          if (siblingIndex !== 1) selector += ':nth-of-type('+siblingIndex+')';
        }
        path.unshift(selector);
        element = element.parentNode;
      }
      return path.join(' > ');
    },

    getSurroundingText: function(element, charLimit = 1000) {
      // Start from the parent of the clicked element
      let container = element.parentNode;
      let text = '';
      
      // Move up the DOM tree until we have enough context or reach the body
      while (container && container !== document.body) {
        text = container.innerText || container.textContent || '';
        text = text.trim();
        if (text.length > charLimit) break;
        container = container.parentNode;
      }
      
      // Truncate and add ellipsis if necessary
      if (text.length > charLimit) {
        text = text.substring(0, charLimit) + '...';
      }
      
      return text;
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

console.log('Gandalf loaded');