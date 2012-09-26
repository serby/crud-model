var _ = require('lodash')
  , Pipe = require('piton-pipe')
  , emptyFn = function() {}
  , events = require('events')
  ;

module.exports = function(name, save, schema, options) {

  var slug = (options && options.slug) ? options.slug : name.toLowerCase().replace(/ /g, '')
    , plural = (options && options.plural) ? options.plural : name + 's'
    , self = new events.EventEmitter()
    ;

  var pre = {
    create: Pipe.createPipe(),
    createValidate: Pipe.createPipe(),
    update: Pipe.createPipe(),
    updateValidate
    : Pipe.createPipe(),
    'delete': Pipe.createPipe()
  };

  if (schema.schema[save.idProperty] === undefined) {
    throw new Error();
  }

  return _.extend(self, {
    name: name,
    slug: slug,
    plural: plural,
    schema: schema,
    idProperty: save.idProperty,
    create: function(object, validateOptions, callback) {

      // Accept create(object, callback)
      if (typeof validateOptions === 'function') {
        callback = validateOptions;
        validateOptions = null;
      }

      callback = callback || emptyFn;

      var cleanObject = schema.cast(schema.stripUnknownProperties(schema.makeDefault(object), validateOptions.tag));

      pre.createValidate.run(cleanObject, function(error, pipedObject) {
        if (error) {
          return callback(error);
        }
        schema.validate(pipedObject, validateOptions.set, validateOptions.tag, function(error, validationErrors) {
          if (error) {
            return callback(error);
          }
          if (Object.keys(validationErrors).length > 0) {
            var validationError = new Error('Validation Error');
            validationError.errors = validationErrors;
            return callback(validationError, pipedObject);
          }
          pre.create.run(pipedObject, function(error, pipedObject) {
            if (error) {
              return callback(error);
            }
            save.create(pipedObject, function(error, savedObject) {
              if (error) {
                return callback(error);
              }
              self.emit('create', savedObject);
              callback(undefined, savedObject);
            });
          });
        });
      });
    },
    read: save.read,
    update: function(object, validateOptions, callback) {

      // Accept update(object, callback)
      if (typeof validateOptions === 'function') {
        callback = validateOptions;
        validateOptions = null;
      }

      callback = callback || emptyFn;

      var cleanObject = schema.cast(schema.stripUnknownProperties(schema.makeDefault(object), validateOptions.tag));

      pre.updateValidate.run(cleanObject, function(error, pipedObject) {
        if (error) {
          return callback(error);
        }
        schema.validate(pipedObject, validateOptions.set, validateOptions.tag,
          function(error, validationErrors) {
          if (error) {
            return callback(error);
          }
          if (Object.keys(validationErrors).length > 0) {
            var validationError = new Error('Validation Error');
            validationError.errors = validationErrors;
            return callback(validationError, pipedObject);
          }
          pre.update.run(pipedObject, function(error, pipedObject) {
            if (error) {
              return callback(error, pipedObject);
            }
            save.update(pipedObject, function(error, savedObject) {
              if (error) {
                return callback(error);
              }
              self.emit('update', savedObject);
              callback(undefined, savedObject);
            });
          });
        });
      });
    },
    'delete': function(id, callback) {
      save['delete'](id, function(error) {
        if (error) {
          return callback(error);
        }
        self.emit('delete', id);
        callback();
      });
    },
    count: save.count,
    find: save.find,
    pre: function(method, processor) {
      return pre[method].add(processor);
    }
  });
};