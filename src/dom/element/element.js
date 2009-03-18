  /*-------------------------------- ELEMENT ---------------------------------*/

  global.$ = (function() {
    function $(element) {
      if (arguments.length > 1) {
        for (var i = 0, elements = [], length = arguments.length; i < length; i++)
          elements.push($(arguments[i]));
        return elements;
      }
      if (typeof element === 'string')
        element = Fuse._doc.getElementById(element || '');
      return Element.extend(element);
    }
    return $;
  })();

  /*--------------------------------------------------------------------------*/

  // cache Element capabilities before overwriting the Element object
  Feature('ELEMENT_EXTENSIONS');
  Feature('ELEMENT_SPECIFIC_EXTENSIONS');

  (function() {
    var original = global.Element;

    function createElement(tagName, attributes) {
      if (!Element.cache[tagName])
        Element.cache[tagName] = Element.extend(Fuse._doc.createElement(tagName));
      return Element.writeAttribute(Element.cache[tagName]
        .cloneNode(false), attributes);
    }

    global.Element = function(tagName, attributes) {
      return createElement(tagName.toUpperCase(), attributes);
    };

    if (Feature('CREATE_ELEMENT_WITH_HTML')) {
      global.Element = function(tagName, attributes) {
        // setAttribute is broken in IE when setting name and type attributes
        // see: http://msdn.microsoft.com/en-us/library/ms536389.aspx
        if (attributes && (attributes.name || attributes.type)) {
          tagName = '<' + tagName +
           (attributes.name ? ' name="' + attributes.name + '"' : '') +
            (attributes.type ? ' type="' + attributes.type + '"' : '') + '>';
          delete attributes.name; delete attributes.type;
        } else tagName = tagName.toUpperCase();
        return createElement(tagName, attributes);
      };
    }

    if (original) {
      // avoid Object.extend() because IE8 cannot set any
      // variable/property reference to Element.toString
      Object._extend(global.Element, original);
      global.Element.prototype = original.prototype;
    }
  })();

  Element.cache = { };
  Element.idCounter = 1;

  /*--------------------------------------------------------------------------*/

  Element.extend = (function() {
    var Methods, ByTag, revision = 0;

    function _createRevisionGetter(r) {
      return function() { return r };
    }

    function extend(element) {
      // Bail on elements that don't need extending,
      // XML nodes (IE errors on them), document, window objects
      if (!element || (typeof element._extendedByFuse !== 'undefined' &&
        element._extendedByFuse() >= revision) ||
        element.nodeType !== 1 || element == getWindow(element) ||
        !element.ownerDocument.body) return element;

      var pair,
       nodeName = getNodeName(element),
       methods  = ByTag[nodeName] || Methods,
       length   = methods.length;

      while (length--) {
        pair = methods[length];
        if (!Object.hasKey(element, pair[0]))
          element[pair[0]] = pair[1];
      }

      // avoid using Fuse.K.curry(revision) for speed
      element._extendedByFuse = _createRevisionGetter(revision);

      return element;
    }

    function refresh() {
      var tagName; Methods = []; ByTag = { };

      Object._each(Element.Methods, function(value, key) {
        if (key !== 'Simulated' && key !== 'ByTag')
          Methods.push([key, value.methodize()]);
      });

      Object._each(Element.Methods.Simulated, function(value, key) {
        Methods.push([key, value.methodize()]);
      });

      for (tagName in Element.Methods.ByTag) {
        ByTag[tagName] = slice.call(Methods, 0);
        Object._each(Element.Methods.ByTag[tagName], function(value, key) {
          ByTag[tagName].push([key, value.methodize()]);
        });
      }
      revision++;
    }

    // Browsers with specific element extensions
    // don't need their elements extended UNLESS
    // they belong to a different document
    if (Feature('ELEMENT_SPECIFIC_EXTENSIONS')) {
      return Object._extend(function(element) {
        return (element && element.ownerDocument &&
          element.ownerDocument !== Fuse._doc) ? extend(element) : element;
      }, { 'refresh': refresh });
    }

    extend.refresh = refresh;
    return extend;
  })();

  Element.addMethods = (function() {
    // add HTMLElement for Safari 2
    if (Feature('OBJECT_PROTO') && !Feature('HTML_ELEMENT_CLASS')) {
      Feature.set('HTML_ELEMENT_CLASS', true);
      Feature.set('ELEMENT_EXTENSIONS', true);
      _emulateDOMClass('HTMLElement');
    }

    var tagNameClassLookup = {
      'A':        'Anchor',
      'CAPTION':  'TableCaption',
      'COL':      'TableCol',
      'COLGROUP': 'TableCol',
      'DEL':      'Mod',
      'DIR':      'Directory',
      'DL':       'DList',
      'H1':       'Heading',
      'H2':       'Heading',
      'H3':       'Heading',
      'H4':       'Heading',
      'H5':       'Heading',
      'H6':       'Heading',
      'IFRAME':   'IFrame',
      'IMG':      'Image',
      'INS':      'Mod',
      'FIELDSET': 'FieldSet',
      'FRAMESET': 'FrameSet',
      'OL':       'OList',
      'OPTGROUP': 'OptGroup',
      'P':        'Paragraph',
      'Q':        'Quote',
      'TBODY':    'TableSection',
      'TD':       'TableCell',
      'TEXTAREA': 'TextArea',
      'TH':       'TableCell',
      'TFOOT':    'TableSection',
      'THEAD':    'TableSection',
      'TR':       'TableRow',
      'UL':       'UList'
    },

    EMULATE_ELEMENT_CLASSES_WITH_PROTO =
      Feature('EMULATE_ELEMENT_CLASSES_WITH_PROTO'),

    elementPrototype = Feature('HTML_ELEMENT_CLASS') ?
      global.HTMLElement.prototype : Feature('ELEMENT_CLASS') ?
        global.Element.prototype : false;

    function _copy(methods, destination, onlyIfAbsent) {
      onlyIfAbsent = onlyIfAbsent || false;
      Object._each(methods, function(value, key) {
        if (typeof value === 'function' && 
           (!onlyIfAbsent || !(key in destination)))
          destination[key] = value.methodize();
      });
    }

    function _emulateDOMClass(className) {
      (global[className] = { }).prototype = Fuse._div['__proto__'];
      return global[className];
    }

    function _extend(tagName, methods) {
      tagName = tagName.toUpperCase();
      if (!Element.Methods.ByTag[tagName])
        Element.Methods.ByTag[tagName] = { };
      Object.extend(Element.Methods.ByTag[tagName], methods);
    }

    function _findDOMClass(tagName) {
      var className = 'HTML' + (tagNameClassLookup[tagName] ||
        tagName.capitalize()) + 'Element';
      if (global[className])
        return global[className];
      className = 'HTML' + tagName + 'Element';
      if (global[className])
        return global[className];
      if (EMULATE_ELEMENT_CLASSES_WITH_PROTO)
        return _emulateDOMClass(className);
    }

    return function(methods) {
      var tagName, T = Element.Methods.ByTag;

      if (!methods) {
        Object.extend(Form, Form.Methods);
        Object.extend(Form.Element, Form.Element.Methods);
        Object.extend(Element.Methods.ByTag, {
          'BUTTON':   Object.clone(Form.Element.Methods),
          'FORM':     Object.clone(Form.Methods),
          'INPUT':    Object.clone(Form.Element.Methods),
          'SELECT':   Object.clone(Form.Element.Methods),
          'TEXTAREA': Object.clone(Form.Element.Methods)
        });
      }

      if (arguments.length == 2) {
        tagName = methods;
        methods = arguments[1];
      }

      if (!tagName)
        Object.extend(Element.Methods, methods);
      else {
        Object.isArray(tagName)
          ? tagName._each(function(name) { _extend(name, methods) })
          : _extend(tagName, methods);
      }

      if (Feature('ELEMENT_EXTENSIONS')) {
        _copy(Element.Methods, elementPrototype);
        _copy(Element.Methods.Simulated, elementPrototype, true);
      }

      if (Feature('ELEMENT_SPECIFIC_EXTENSIONS')) {
        var klass, tagName, infiniteRevision = function() { return Infinity };
        for (tagName in Element.Methods.ByTag) {
          klass = _findDOMClass(tagName);
          if (typeof klass === 'undefined') continue;
          _copy(T[tagName], klass.prototype);
        }
        elementPrototype._extendedByFuse = infiniteRevision;
      }

      Object.extend(Element, Element.Methods);
      delete Element.ByTag;

      Element.extend.refresh();
      Element.cache = { };
    };
  })();

  /*--------------------------------------------------------------------------*/

  (function() {
    Element.Methods = {
      'ByTag': { },

      'Simulated': { },

      // removes whitespace-only text node children
      'cleanWhitespace': function cleanWhitespace(element) {
        element = $(element);
        var nextNode, node = element.firstChild;
        while (node) {
          nextNode = node.nextSibling;
          if (node.nodeType === 3 && !/\S/.test(node.nodeValue))
            element.removeChild(node);
          node = nextNode;
        }
        return element;
      },

      'empty': function empty(element) {
        return $(element).innerHTML.blank();
      },

      'getDimensions': function getDimensions(element) {
        return { 'width': Element.getWidth(element), 'height': Element.getHeight(element) };
      },

      'getOffsetParent': function getOffsetParent(element) {
        // http://www.w3.org/TR/cssom-view/#offset-attributes
        element = $(element);
        var original = element, nodeName = getNodeName(element);
        if (nodeName === 'AREA') return Element.extend(element.parentNode); 

        // IE throws an error if the element is not in the document.
        if (Element.isFragment(element) || !element.offsetParent)
          return Element.extend(getDocument(element).body);

        while (element = element.offsetParent) {
          nodeName = getNodeName(element);
          if (nodeName === 'BODY'  || nodeName === 'HTML') break;
          if (nodeName === 'TABLE' || nodeName === 'TD' || nodeName === 'TH' ||
              Element.getStyle(element, 'position') !== 'static')
            return Element.extend(element);
        }
        return Element.extend(getDocument(original).body);
      },

      'identify': function identify(element) {
        var id = Element.readAttribute(element, 'id');
        if (id) return id;

        var ownerDoc = element.ownerDocument;
        do { id = 'anonymous_element_' + Element.idCounter++ }
        while (ownerDoc.getElementById(id));
        Element.writeAttribute(element, 'id', id);
        return id;
      },

      'inspect': function inspect(element) {
        element = $(element);
        var attribute, value, result = '<' + element.nodeName.toLowerCase(),
         translation = { 'id':'id', 'className':'class' };

        for (var property in translation) {
          attribute = translation[property];
          value = (element[property] || '').toString();
          if (value) result += ' ' + attribute + '=' + value.inspect(true);
        }
        return result + '>';
      },

      'isFragment':  (function() {
        var isFragment = Feature('ELEMENT_SOURCE_INDEX', 'DOCUMENT_ALL_COLLECTION') ?
          function isFragment(element) {
            element = $(element);
            var nodeType = element.nodeType;
            return nodeType === 11 || (nodeType === 1 &&
              element.ownerDocument.all[element.sourceIndex] !== element);
          } :
          function isFragment(element) {
            element = $(element);
            var nodeType = element.nodeType;
            return nodeType === 11 || (nodeType === 1 && !(element.parentNode &&
              Element.descendantOf(element, element.ownerDocument)));
          };
        return isFragment;
      })(),

      'hide': function hide(element) {
        element = $(element);
        var display = element.style.display;
        if (display && display !== 'none')
          element._originalDisplay = display;
        element.style.display = 'none';
        return element;
      },

      'show': function show(element) {
        element = $(element);
        var display = element.style.display;
        if (display === 'none')
          element.style.display = element._originalDisplay || '';
        element._originalDisplay = null;
        return element;
      },

      'scrollTo': function scrollTo(element) {
        var pos = Element.cumulativeOffset(element);
        global.scrollTo(pos[0], pos[1]);
        return $(element);
      },

      'remove': function remove(element) {
        element = $(element);
        element.parentNode &&
        element.parentNode.removeChild(element);
        return element;
      },

      'toggle': function toggle(element) {
        return Element[Element.visible(element) ? 'hide' : 'show'](element);
      },

      'visible': function visible(element) {
        return $(element).style.display != 'none';
      },

      'wrap': function wrap(element, wrapper, attributes) {
        element = $(element);
        if (Object.isElement(wrapper))
          $(wrapper).writeAttribute(attributes);
        else if (typeof wrapper === 'string')
          wrapper = new Element(wrapper, attributes);
        else wrapper = new Element('div', wrapper);
        if (element.parentNode)
          element.parentNode.replaceChild(wrapper, element);
        wrapper.appendChild(element);
        return wrapper;
      }
    };

    // prevent JScript bug with named function expressions
    var cleanWhitespace = null,
     empty =              null,
     getDimensions =      null,
     getOffsetParent =    null,
     hide =               null,
     identify =           null,
     inspect =            null,
     isFragment =         null,
     remove =             null,
     scrollTo =           null,
     show =               null,
     toggle =             null,
     visible =            null,
     wrap =               null;
  })();

  Object._extend(Element.Methods, (function() {

    var _isInsertable = (function() {
      // comment, document fragment, document type, element, and text nodes are insertable
      var insertable = { '1':1, '3':1, '8':1, '10':1, '11':1 };
      return function(node) {
        return insertable[node.nodeType] === 1;
      }
    })();

    return {
      'insert': (function() {
         function insert(element, insertions) {
          element = $(element);
          var content, fragment, insertContent, position, nodeName, type = typeof insertions;
          if (insertions && (type === 'string' || type === 'number' ||
              _isInsertable(insertions) || insertions.toElement || insertions.toHTML)) {
            insertions = { 'bottom':insertions };
          }

          for (position in insertions) {
            content  = insertions[position];
            position = position.toLowerCase();
            insertContent = Element._insertionTranslations[position];

            if (content) {
              if (content.toElement) content = content.toElement();
              if (_isInsertable(content)) {
                insertContent(element, content);
                continue;
              }
              content = Object.toHTML(content);
            }
            else continue;

            nodeName = getNodeName(position === 'before' || position === 'after'
              ? element.parentNode : element);

            fragment = Element._getContentFromAnonymousElement(
              element.ownerDocument, nodeName, content.stripScripts());

            insertContent(element, fragment);
            content.evalScripts.bind(content).defer();
          }
          return element;
        }
        return insert;
      })(),

      'replace': (function() {
        var _createContextualFragment = Feature('DOCUMENT_RANGE_CREATE_CONTEXTUAL_FRAGMENT') ?
          function(element, content) {
            var range = element.ownerDocument.createRange();
            range.selectNode(element);
            return range.createContextualFragment(content);
          } :
          function(element, content) {
            return Element._getContentFromAnonymousElement(element.ownerDocument,
              getNodeName(element.parentNode), content);
          };

        function replace(element, content) {
          element = $(element);
          if (!content)
            return element.parentNode.removeChild(element);
          if (content.toElement)
            content = content.toElement();
          else if (!_isInsertable(content)) {
            content = Object.toHTML(content);
            content.evalScripts.bind(content).defer();
            content = _createContextualFragment(element, content.stripScripts());
          }
          return element.parentNode.replaceChild(content, element);
        }

        return replace;
      })(),

      'update': (function() {
         var update =
             Bug('ELEMENT_SELECT_INNERHTML_BUGGY') ||
             Bug('ELEMENT_TABLE_INNERHTML_BUGGY')  ||
             Bug('ELEMENT_TABLE_INNERHTML_INSERTS_TBODY') ?

          function update(element, content) {
            element = $(element);
            var nodeName = getNodeName(element),
             isBuggy = Element._insertionTranslations.tags[nodeName];

            // remove children
            if (isBuggy) {
              while (element.lastChild)
                element.removeChild(element.lastChild);
            } else element.innerHTML = '';

            if (content) {
              if (content.toElement) content = content.toElement();
              if (_isInsertable(content)) element.appendChild(content);
              else {
                content = Object.toHTML(content);
                if (isBuggy)
                  element.appendChild(Element._getContentFromAnonymousElement(
                    element.ownerDocument, nodeName, content.stripScripts()));
                else element.innerHTML = content.stripScripts();
                content.evalScripts.bind(content).defer();
              }
            }
            return element;
          } :
          function update(element, content) {
            element = $(element);
            if (content) {
              if (content.toElement)
                content = content.toElement();
              if (_isInsertable(content)) {
                element.innerHTML = '';
                element.appendChild(content);
                return element;
              }
              content = Object.toHTML(content);
              element.innerHTML = content.stripScripts();
              content.evalScripts.bind(content).defer();
            } else element.innerHTML = '';
            return element;
          };
        return update;
      })()
    };
  })());

  // define Element#getWidth() and Element#getHeight()
  $w('Width Height')._each(function(D) {
    Element.Methods['get' + D] = function(element) {
      element = $(element);
      var result, display = Element.getStyle(element, 'display');

      // offsetHidth/offsetWidth properties return 0 on elements
      // with display:none, so show the element temporarily
      if (display === 'none' || display === null) {
        var backup = element.style.cssText;
        element.style.cssText += ';display:block;visibility:hidden;';
        result = element['offset' + D];
        element.style.cssText = backup;
      }
      else result = element['offset' + D];

      return result;
    };
  });
