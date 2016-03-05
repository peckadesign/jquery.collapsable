/**
 * jQuery Collapsable - jQuery plugin for collapsable boxes 
 * http://zipper.github.io/jquery.collapsable/
 *
 * @author Radek Šerý <radek.sery@gmail.com>
 * @copyright Copyright (c) 2014-2016 Radek Šerý
 * @license MIT
 *
 * @version 2.0.1
 */
;(function($) {

	// @feature: díky předávání originalEvent do expand.collapsable (atd.) je možné použít e.originalEvent.preventDefault() místo defaults.preventDefault! cool, ne?!

	/**
	 * Collapsable defaults
	 * @type {{control: string, box: string, event: string, fx: boolean, fxDuration: number, grouped: boolean, collapsableAll: boolean, preventDefault: boolean, extLinks: {selector: null, preventDefault: boolean, activeClass: string}, classNames: {expanded: string, collapsed: string, defaultExpanded: string}}}
	 */
	var defaults = {
		control: '.ca-control', // CSS selector for control element
		box: '.ca-box',         // CSS selector for hideable element (box)
		event: 'click',         // event triggering the expand/collapse

		fx: null,               // effect for expanding/collapsing, [ false | toggle | slide | fade | {Object} ]
		fxDuration: 0,          // duration of the effect, affects delay between `expand.collapsable`(`collapse.collapsable`) and `expanded.collapsable` (`collapsed.collapsable`) evetns are triggered; default value is 500 when fx set to slide

		grouped: false,         // determines, if there could be more than one expanded box in same time; related to jQuery set on which initialized
		collapsableAll: true,   // possibility of collapsing all boxes from set
		preventDefault: true,   // whether prevenDefault should be called when specified event occurs on control; even if false, e.originalEvent.preventDefault() may be used inside collapsable event handlers

		extLinks: {             // external links for operating collapsable set, can be anywhere else in DOM
			selector: '',       // CSS selector for external links; it has to be anchors; the click event is binded
			preventDefault: false // whether preventDefault is called on extLinks click
		},

		classNames: {            // CSS class names to be used on collapsable box; they are added to element, on which collapsable has been called
			expanded: 'ca-expanded',
			collapsed: 'ca-collapsed',
			defaultExpanded: 'ca-default-expanded',
			extLinkActive: 'ca-ext-active'
		}

		// callbacks are no more available, use event handlers instead
	};


	/**
	 * Public methods available via jQuery adapter
	 * @type {{init: methods.init, expandAll: methods.expandAll, collapseAll: methods.collapseAll, destroy: methods.destroy}}
	 */
	var methods = {
		init: function (options) {
			return new Collapsable(this, options);
		},
		expandAll: function (data) {
			handlePublicMethods.call(this, 'expandAll', data);
		},
		collapseAll: function (data) {
			handlePublicMethods.call(this, 'collapseAll', data);
		},
		destroy: function (data) {
			handlePublicMethods.call(this, 'destroy', data);
		}
	};


	/**
	 * Last used uid index
	 * @type {number}
	 * @private
	 */
	var caUid = 0;


	/**
	 * Generates unique id for new Collapsable object
	 * @returns {String}  New uid
	 * @private
	 */
	function getUid() {
		return 'ca-uid-' + caUid++;
	}


	/**
	 * Handles public method called on jQuery object using adapter
	 * @param {String} action - collapseAll|expandAll|destroy
	 * @param {Object} data - Data passed by user
	 * @private
	 */
	function handlePublicMethods(action, data) {
		var processed = [];
		this.each(function () {
			var instance = $(this).data('collapsable');
			if (instance) {
				var uid = instance.parent.uid;

				if (processed.indexOf(uid) === -1) {
					processed.push(uid);

					instance.parent[action](data);
				}
			}
		});
	}


	/**
	 * Finds ext links specified in options and bind click event to them for opening
	 * @this Collapsable
	 * @todo create possibility for extLinks would only open the boxes? for now, it might be achieved using event handlers and e.preventDefault
	 * @private
	 */
	function handleExtLinks() {
		var opts = this.opts;
		if ((this.$extLinks = $(opts.extLinks.selector).filter('a')).length) {
			this.$extLinks.on('click.collapsable', function (event) {
				if (opts.extLinks.preventDefault)
					event.preventDefault();

				var collapsable = $($(this).attr('href')).data('collapsable');

				if (collapsable) {
					collapsable.$controlLink.first().trigger(opts.event + '.collapsable', event);
				}
			});
		}
	}


	/**
	 * Prepare default expanded item. Checks the necessity of expanded item (collapsableAll set to false && grouped set
	 * to true) and limits amount of default expanded items to 1 when grouped option set to true. Also when there's
	 * fragment in url targeting existing collapsable item, default expanded set using class in DOM will be overridden.
	 *
	 * @summary Sets the defaultExpanded flag to appropriate CollapsableItems
	 * @this Collapsable
	 * @private
	 */
	function prepareDefaultExpanded() {
		var fragment = window.location.href;
		var i = fragment.search(/#/);

		var defaultExpanded = -1;
		var defaultExpandedFromUrl = -1;
		var $items = $($.map(this.items, function (item) {
			return item.$collapsable.get();
		}));

		// search for #hash in url
		if (i !== -1) {
			fragment = fragment.substring(i + 1);
			defaultExpandedFromUrl = $items.index($('#' + fragment));

			if (defaultExpandedFromUrl !== -1) {
				this.items[defaultExpandedFromUrl].defaultExpanded = true;

				// max 1, we can return now
				if (this.opts.grouped) {
					return;
				}
			}
		}

		// max 1 expanded item
		if (this.opts.grouped) {
			defaultExpanded = $items.index($('.' + this.opts.classNames.defaultExpanded));

			// max 1, we can return now
			if (defaultExpanded !== -1) {
				this.items[defaultExpanded].defaultExpanded = true;
				return;
			}
		}

		// not grouped, we add flag to all items with class
		else {
			var that = this;
			$items.each(function (i) {
				if ($(this).hasClass(that.opts.classNames.defaultExpanded)) {
					defaultExpanded = i; // for later use it is sufficient to have last index only
					that.items[i].defaultExpanded = true;
				}
			});
		}

		// if we need one and none was found yet, we take the first
		if (defaultExpandedFromUrl === -1 && defaultExpanded === -1 && !this.opts.collapsableAll) {
			this.items[0].defaultExpanded = true;
		}
	}


	/**
	 * Expand or collapse item based on flags set in prepareDefaultExpanded method; called on initialization within the
	 * context of Collapsable
	 * @todo When !opts.collapseAll && opts.grouped, we now force-open the first item with defaultExpanded flag, regardless how it got it (hash in url or class); potentially force-open the one from URL instead of first, if hash set? or maybe try to open some without forcing and only if failed, do force-open (would require two passes)?
	 * @this Collapsable
	 * @private
	 */
	function handleDefaultExpanded() {
		var event = $.Event('init.collapsable');
		var opts = this.opts;
		var items = this.items;

		// save fx so it can be set back
		var fx = opts.fx;

		// for initialization, we don't want to use any effect
		if (opts.fx)
			opts.fx = 'toggle';

		var l = items.length;
		var force = !opts.collapsableAll; // if we can't collapse all, we force expanding the first one chosen in prepareDefaultExpanded
		for (var i = 0; i < l; i++) {
			if (items[i].defaultExpanded) {
				items[i].expand(event, null, force);
				force = false;
			} else {
				items[i].collapse(event, null, true); // on init, we want to force-close all - if false returned, than the class might have been set in first place (so it would go into if statement above)
			}
		}

		opts.fx = fx;
	}


	/**
	 * It is possible to set the `fx` options to `slide` or `fade` - these are shortcuts for objects with
	 * `{ expand: 'slideDown', collapse: 'slideUp' }` or `{ expand: 'fadeIn', collapse: 'fadeOut' }`. This function
	 * converts those strings into objects. It also sets default duration for these effects to 500ms.
	 * @this Collapsable
	 * @private
	 */
	function prepareFxOpt() {
		var opts = this.opts;

		// default fxDuration in case of slide function
		if (opts.fx === 'slide' || opts.fx === 'fade') {
			opts.fxDuration = opts.fxDuration || 500;
		}

		// convert alias into objects
		if (opts.fx === 'slide') {
			opts.fx = {
				expand: 'slideDown',
				collapse: 'slideUp'
			};
		} else if (this.opts.fx === 'fade') {
			opts.fx = {
				expand: 'fadeIn',
				collapse: 'fadeOut'
			};
		}
	}


	/**
	 * Represents set of collapsable elements which were initialized by one call with same options
	 * @name Collapsable
	 * @param {jQuery} $boxSet - Set of object to be initilized
	 * @param {Object} options - See plugin defaults
	 * @returns {Collapsable}
	 * @constructor
	 */
	var Collapsable = function ($boxSet, options) {
		this.opts = $.extend(true, {}, $.fn.collapsable.defaults, options);
		this.items = [];

		var that = this;

		this.uid = getUid();
		this.promiseOpen = false;

		handleExtLinks.call(this);

		prepareFxOpt.call(this);

		$boxSet.each(function () {
			var collapsable = new CollapsableItem(that, this);

			if (collapsable.$box.length && collapsable.$control.length) {
				that.items.push(collapsable);
			}
		});

		prepareDefaultExpanded.call(this);
		handleDefaultExpanded.call(this);

		return this;
	};

	/**
	 * Returns indexes of expanded items in Collapsable.items
	 * @returns {Array}
	 */
	Collapsable.prototype.getExpanded = function () {
		var expanded = [];
		var l = this.items.length;

		for (var i = 0; i < l; i++) {
			if (this.items[i].isExpanded) {
				expanded.push(i);
			}
		}

		return expanded;
	};


	/**
	 * Expands all collapsed items
	 * @param {Object} data - Data to be passed to triggered event
	 */
	Collapsable.prototype.expandAll = function (data) {
		// if grouped, we only want to expand one (first) box, or none if already expanded
		if (this.opts.grouped && this.getExpanded().length) {
			return;
		}

		var event = $.Event('expandAll.collapsable');

		var l = this.items.length;

		for (var i = 0; i < l; i++) {
			if (! this.items[i].isExpanded) {
				var expanded = this.items[i].expand(event, data);

				if (this.opts.grouped && expanded) {
					break;
				}
			}
		}
	};


	/**
	 * Collapses all expanded items
	 * @param {Object} data - Data to be passed to triggered event
	 */
	Collapsable.prototype.collapseAll = function (data) {
		var event = $.Event('collapseAll.collapsable');

		var expandedItems = this.getExpanded();
		var l = expandedItems.length;

		for (var i = 0; i < l; i++) {
			this.items[expandedItems[i]].collapse(event, data);
		}
	};


	/**
	 * Destroy collapsable and reverts DOM changes to state prior initialization
	 */
	Collapsable.prototype.destroy = function () {
		var opts = this.opts;

		var l = this.items.length;
		for (var i = 0; i < l; i++) {
			var item = this.items[i];

			// remove classes and event handlers from main element
			item.$collapsable
				.removeClass(opts.classNames.collapsed + ' ' + opts.classNames.expanded)
				.removeData('collapsable');

			// revert control element
			item.$control.find('[data-ca-created]').each(function () {
				$(this).parent().html($(this).html());
			});
			item.$control
				.find('.ca-link').addBack('.ca-link')
				.off(opts.event + '.collapsable')
				.removeClass('ca-link')
				.removeAttr('aria-controls')
				.removeAttr('aria-expanded');

			// revert box element
			var style = item.$box.data('ca-pre-init-style') || '';
			item.$box
				.attr('style', style)
				.removeData('ca-pre-init-style')
				.removeAttr('aria-hidden');

			item.$collapsable.trigger('destroy.collapsable');
		}

		// remove
		this.$extLinks.off('click.collapsable');
	};


	/**
	 * Prepares DOM structure for collapsable element. Each ca-control element is tested for being anchor. If there's
	 * match, the element (anchor) is added class `ca-link`. If no match, we try to find anchor inside and add class
	 * to each of them as well. If ca-control is not an anchor and contains no anchor, we wrap inside to anchor with
	 * appropriate class and custom data attribute for potential destroy handle. It also stores default style attribute
	 * of box element for later use in destroy handle.
	 * @summary Prepares DOM structure for collapsable element
	 * @this CollapsableItem
	 * @private
	 */
	function prepareCollapsableDOM() {
		var collapsableItem = this;

		if (! collapsableItem.id) {
			collapsableItem.id = getUid();
			collapsableItem.$collapsable.attr('id', this.id);
		}

		var boxId = collapsableItem.$box.attr('id') || collapsableItem.id + '-ca-box';
		collapsableItem.$box
			.attr('id', boxId)
			.data('ca-pre-init-style', collapsableItem.$box.attr('style'));

		collapsableItem.$control.each(function() {
			var $el = $(this);
			var $a;

			// a.ca-control -> add class .ca-link
			if ($el.is('a')) {
				$a = $el;
			}
			// .ca-control a -> add class .ca-link
			else if (($a = $el.find('a')).length) {
			}
			// no anchor found, create custom
			else {
				$el.wrapInner('<a data-ca-created href="#' + collapsableItem.id + '"></a>');
				$a = $el.find('a');
			}

			$a.addClass('ca-link');
			$a.attr('aria-controls', boxId);
		});

	}


	/**
	 * Single item in Collapsable object, represents one collapsable element in page
	 * @param {Collapsable} parent - Reference to group of Collapsable elements initialized in same time, sharing same options
	 * @param {jQuery} element     - One instance of collapsable element
	 * @returns {CollapsableItem}
	 * @constructor
	 */
	var CollapsableItem = function(parent, element) {
		this.parent = parent;
		this.$collapsable = $(element);
		this.id = this.$collapsable.attr('id');
		this.$control = this.$collapsable.find(parent.opts.control);
		this.$box     = this.$collapsable.find(parent.opts.box);

		if (this.$control.length == 0 || this.$box.length == 0)
			return;

		var that = this;
		var opts = this.parent.opts; // shortcut

		prepareCollapsableDOM.call(this);

		this.$controlLink = this.$control.find('.ca-link');

		// originalEvent contains arguments passed when trigger is called, used for passing event that triggered opening (eg. extLink click)
		this.$controlLink.on(opts.event + '.collapsable', function(event, originalEvent) {
			var passEvent = originalEvent ? originalEvent : event;
			if (opts.preventDefault) {
				event.preventDefault();
			}

			if (that.isExpanded) {
				that.collapse(passEvent);
			}
			else {
				that.expand(passEvent);
			}
		});

		this.$collapsable.data('collapsable', this);

		return this;
	};


	/**
	 * Handling common parts of expanding and collapsing
	 * @param {String} action - Either `expand` or `collapse`
	 * @param {Object} data - Data passed to triggered event
	 * @param {Event} originalEvent - Event to be passed to event handlers
	 * @returns {boolean}
	 */
	function handleExpandCollapse(action, originalEvent, data) {
		var opts = this.parent.opts;
		var that = this;
		var trigger = 'expanded';
		var addClass = opts.classNames.expanded;
		var removeClass = opts.classNames.collapsed;

		// capitalize first letter
		if (action === 'collapse') {
			trigger = 'collapsed';
			addClass = opts.classNames.collapsed;
			removeClass = opts.classNames.expanded;
		}

		var event = $.Event(trigger + '.collapsable', { customData: data, originalEvent: originalEvent });

		this.isExpanded = action === 'expand';

		// update extLinks
		this.parent.$extLinks
			.filter('[href=#' + this.id + ']')
			[action === 'expand' ? 'addClass' : 'removeClass'](opts.classNames.extLinkActive);

		// aria support
		this.$controlLink.attr('aria-expanded', action === 'expand');
		this.$box.attr('aria-hidden', action !== 'expand');

		// actually toggle the box state
		if(opts.fx && typeof opts.fx === 'object') {
			this.$box[opts.fx[action]](opts.fxDuration, function () {
				that.$collapsable.trigger(event);
			});
		}
		else {
			if(opts.fx === 'toggle') {
				this.$box[action === 'expand' ? 'show' : 'hide']();
			}

			setTimeout(function () {
				that.$collapsable.trigger(event);
			}, opts.fxDuration);
		}

		// update classes on collapsable element itself
		this.$collapsable
			.removeClass(removeClass)
			.addClass(addClass);

		return true;
	}

	/**
	 * Expands single CollapsableItem; could be prevented by `preventDefault` called on `expand.collapsable` event
	 * @param {Object} originalEvent  - Event passed to triggered event
	 * @param {Object} data - Data passed to triggered event
	 * @param {Boolean} force - Forcing CollapsableItem to expand regardless on onExpand return value, should be used only on initilization (force open default expanded item when collapsableAll === false)
	 * @returns {Boolean}     - Returns if CollapsableItem has been expanded or not
	 */
	CollapsableItem.prototype.expand = function(originalEvent, data, force) {
		var opts = this.parent.opts;
		var expandedItem = this.parent.getExpanded(); // grouped -> max one expanded item

		this.parent.promiseOpen = true; // allows us to collapse expanded item even if there might be collapseAll === false option
		if (opts.grouped) {
			// before expanding, we have to collapse previously opened item, if grouped element hasn't collapsed, we can't continue
			if (expandedItem.length && this.parent.items[expandedItem[0]].collapse(originalEvent, data, force) === false) {
				this.parent.promiseOpen = false;
				return false;
			}
		}
		this.parent.promiseOpen = false;

		var event = $.Event('expand.collapsable', { customData: data, originalEvent: originalEvent });
		this.$collapsable.trigger(event);

		if (event.isDefaultPrevented() && ! force) {
			// collapsableAll === false && grouped === true -> if the box has not opened, we must make sure something is opened, therefore we force-open previously opened box (opts.grouped is true means we tried to collapse something), simulating it has never closed in first place
			if (! opts.collapsableAll && opts.grouped) {
				this.parent.items[expandedItem[0]].expand(originalEvent, data, true);
			}

			return false;
		}

		return handleExpandCollapse.call(this, 'expand', originalEvent)
	};

	/**
	 * Collapses single CollapsableItem; could be prevented by `preventDefault` called on `collapse.collapsable` event
	 * @param {Object} originalEvent  - Event passed to triggered event
	 * @param {Object} data - Data passed to triggered event
	 * @param {Boolean} force - Forcing CollapsableItem to collapse regardless on onCollapse return value
	 * @returns {Boolean}     - Returns if CollapsableItem has been collapsed or not
	 */
	CollapsableItem.prototype.collapse = function(originalEvent, data, force) {
		var opts = this.parent.opts;
		// if we can't collapse all, we are not promised to open something and there is only one opened box, then we can't continue
		if (! opts.collapsableAll && ! this.parent.promiseOpen && this.parent.getExpanded().length < 2) {
			return false;
		}

		var event = $.Event('collapse.collapsable', { customData: data, originalEvent: originalEvent });
		this.$collapsable.trigger(event);

		if (event.isDefaultPrevented() && !force) {
			return false;
		}

		return handleExpandCollapse.call(this, 'collapse', originalEvent);
	};


	/**
	 * The jQuery plugin namespace.
	 * @external "jQuery.fn"
	 * @see {@link http://learn.jquery.com/plugins The jQuery Plugin Guide}
	 */


	/**
	 * jQuery adapter for Collapsable object, returns elements on which it was called, so it's chainable
	 * @function external:"jQuery.fn".collapsable
	 * @param {Object} options - Options to override plugin defaults
	 * @returns {jQuery}
	 */
	$.fn.collapsable = function(options) {
		if (methods[options]) {
			return methods[options].apply(this, Array.prototype.slice.call(arguments, 1));
		}
		else if (typeof options === 'object' || !options) {
			methods.init.apply(this, arguments);
			return this;
		}
		else {
			$.error('Method ' + options + ' does not exist on jQuery.collapsable');
		}
	};

	$.fn.collapsable.defaults = defaults;

})(jQuery);
