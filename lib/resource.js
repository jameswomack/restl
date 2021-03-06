'use strict';

var Representation = require('./representation');
var url = require('url');
var FollowablePromise = require('./followable-promise');
var Promise = require('bluebird');

var Resource = function(client, uri) {

  this.client = client;
  this.uri = uri;
  this.rep = null;

};

Resource.prototype = {

  /**
   * Fetches the resource representation.
   * Returns a promise that resolves to a parsed json object.
   */
  get: function() {

    return this.representation().then(function(r) {
      return r.body;
    });

  },

  /**
   * Updates the resource representation with a new JSON object.
   */
  put: function(body) {

    return this.request({
      method: 'PUT',
      uri: this.uri,
      body: body
    }).then(function() {
      return null;
    });

  },

  /**
   * Updates the resource representation with a new JSON object.
   */
  delete: function(body) {

    return this.request({
      method: 'DELETE',
      uri: this.uri,
      body: body
    }).then(function() {
      return null;
    });

  },

  /**
   * Sends a POST request to the resource.
   *
   * This function assumes that POST is used to create new resources, and
   * that the response will be a 201 Created along with a Location header that
   * identifies the new resource location.
   *
   * This function returns a Promise that resolves into the newly created
   * Resource.
   *
   * If no Location header was given, it will resolve still, but with an empty
   * value.
   */
  post: function(body) {

    return this.request({
      method: 'POST',
      uri: this.uri,
      body: body
    }).then(function(response) {
      if (response.headers.location) {
        return new Resource(
           this.client,
           response.headers.uri
        );
      }
    }.bind(this));
  },

  /**
   * Refreshes the representation for this resource.
   * Returns an empty Promise.
   */
  refresh: function() {

    return this.request({
      method: 'GET',
      uri: this.uri
    }).then(function(response) {
      this.repr = new Representation(
        response.headers['content-type'],
        response.body
      );
    }.bind(this));

  },

  /**
   * Returns the links for this resource, as a promise.
   *
   * The rel argument is optional. If it's given, we will only return links
   * from that relationship type.
   */
  links: function(rel) {

    return this.representation().then(function(r) {
      if (!rel) return r.links;
      return r.links.filter( function(item) { return item.rel === rel; } );
    });

  },

  /**
   * Follows a relationship, based on its reltype. For example, this might be
   * 'alternate', 'item', 'edit' or a custom url-based one.
   *
   * Returns a new Resource object
   */
  follow: function(rel) {

    return new FollowablePromise(function(res, rej) {

      this.links(rel)
        .then(function(links) {

          if (links.length === 0) {
            throw new Error('Relation with type ' + rel + ' not found on resource ' + this.uri);
          }
          res(new Resource(
             this.client,
             url.resolve(this.uri, links[0].href)
          ));
        }.bind(this))
        .catch(function(reason) {
          rej(reason);
        });

    }.bind(this));

  },

  /**
   * Follows a relationship based on its reltype. This function returns a
   * Promise that resolves to an array of Resource objects.
   *
   * If no resources were found, the array will be empty.
   */
  followAll: function(rel) {

    return this.links(rel).then(function(links) {

      return links.map(function(link) {
        return new Resource(
          this.client,
          url.resolve(this.uri, link.href)
        );
      }.bind(this));
    }.bind(this));
  },

  /**
   * Returns the representation for the object.
   *
   * If it wasn't fetched yet, this function does the fetch as well.
   */
  representation: function() {

    if (this.repr) {
      return Promise.resolve(this.repr);
    } else {
      return this.refresh().then(function() {
        return this.repr;
      }.bind(this));
    }

  },

  /**
   * Does an arbitrary HTTP request on the resource, and returns the HTTP
   * response object from the Request library, wrapped in a Promise.
   */
  request: function(options) {

    return this.client.request(options);

  }

};

module.exports = Resource;
