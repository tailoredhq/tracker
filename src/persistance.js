(function(window) {
  var Persistence = function(config) {
      this.config = {
          visitorIdCookieKey: 'yt_visitor_id',
          userIdCookieKey: 'yt_user_id',
          visitorIdLocalStorageKey: 'yt_visitor_id',
          userIdLocalStorageKey: 'yt_user_id',
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

  // Expose Persistence to the global scope
  window.YTPersistence = Persistence;
})(window);