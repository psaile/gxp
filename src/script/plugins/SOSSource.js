/**
 * Copyright (c) 2008-2011 The Open Planning Project
 * 
 * Published under the GPL license.
 * See https://github.com/opengeo/gxp/raw/master/license.txt for the full text
 * of the license.
 */

/**
 * @requires util.js
 * @requires plugins/LayerSource.js
 * @requires OpenLayers/Layer/Vector.js
 * @requires OpenLayers/Format/SOSCapabilities.js
 * @requires OpenLayers/Format/SOSGetFeatureOfInterest.js
 * @requires data/SOSGetObservation.js
 * @requires data/SOSCapabilitiesReader.js
 * @requires data/SOSCapabilitiesStore.js
 * @requires data/SOSObservationReader.js
 * @requires data/SOSObservationStore.js
 
 
 /**
 * The SOSCapabilities and SOSGetFeatureOfInterest formats parse the document and
 * pass the raw data to the SOSCapabilitiesReader/AttributeReader.  There,
 * records are created from layer data.  The rest of the data is lost.  It
 * makes sense to store this raw data somewhere - either on the OpenLayers
 * format or the GeoExt reader.  Until there is a better solution, we'll
 * override the reader's readRecords method  here so that we can have access to
 * the raw data later.
 * 
 /** api: (define)
 *  module = gxp.plugins
 *  class = SOSSource
 */

/** api: (extends)
 *  plugins/LayerSource.js
 */
Ext.namespace("gxp.plugins");

/** api: constructor
 *  .. class:: SOSSource(config)
 *
 *    Plugin for using SOS sensors as layers with :class:`gxp.Viewer` instances. The
 *    plugin issues a GetCapabilities request to create a store of the SOS's
 *    sensors.
 */
/** api: example
 *  Configuration in the  :class:`gxp.Viewer`:
 *
 *  .. code-block:: javascript
 *
 *    defaultSourceType: "gxp_sossource",
 *    sources: {
 *        "grdc": {
 *            url: "http://kiwis.kisters.de/KiWIS/KiWIS?datasource=0"
 *        }
 *    }
 *
 *  A typical configuration for a layer from this source (in the ``layers``
 *  array of the viewer's ``map`` config option would look like this:
 *
 *  .. code-block:: javascript
 *
 *    {
 *        source: "grdc",
 *        name: "GRDC discharge gauging stations",
 *        group: "overlay"
 *    }
 *
 * An optional 'getFeatureInfo' property can also be passed to
 * customize the sort order, visibility, & labels for layer attributes.
 * A sample 'getFeatureInfo' configuration would look like this:
 *
 *  .. code-block:: javascript
 *
 *    {
 *        fields: ["twn_name","pop1990"]
 *        propertyNames: {"pop1990": "1990 Population",  "twn_name": "Town"}
 *    }
 *
 *  Within the 'getFeatureInfo' configuration, the 'fields' property determines sort
 *  order & visibility (any attributes not included are not displayed) and
 *  'propertyNames'  specifies the labels for the attributes.
 *
 *  For initial programmatic layer configurations, to leverage lazy loading of
 *  the Capabilities document, it is recommended to configure layers with the
 *  fields listed in :obj:`requiredProperties`.
 */
gxp.plugins.SOSSource = Ext.extend(gxp.plugins.LayerSource, {
    /** api: ptype = gxp_sossource */
    ptype: "gxp_sossource",
    /** api: config[url]
     *  ``String`` SOS service URL for this source
     */

    /** private: config[restUrl]
     *  ``String`` Optional URL for rest configuration endpoint.  
     */

    /** api: config[baseParams]
     *  ``Object`` Base parameters to use on the SOS GetCapabilities
     *  request.
     */
    baseParams: null,
    /** private: property[format]
     *  ``OpenLayers.Format`` Optional custom format to use on the 
     *  SOSCapabilitiesStore store instead of the default.
     */
    format: null,
    /** private: property[describeLayerStore]
     *  ``GeoExt.data.SOSDescribeLayerStore`` additional store of layer
     *  descriptions. Will only be available when the source is configured
     *  with ``describeLayers`` set to true.
     */
    describeLayerStore: null,
    /** private: property[describedLayers]
     */
    describedLayers: null,
    /** private: property[schemaCache]
     */
    schemaCache: null,
    /** private: property[ready]
     *  ``Boolean``
     */
    ready: false,
    /** api: config[version]
     *  ``String``
     *  By default, version is set to '1.0.0'. Currently OL is only capable of parsing SOS v1. SOSv2
     *  will follow soon
     */

    version: "1.0.0",
    /** api: config[requiredProperties]
     *  ``Array(String)`` List of config properties that are required for each
     *  layer from this source to allow lazy loading, in addition to ``name``.
     *  Default is ``["title", "bbox"]``. When the source loads layers from a
     *  SOS that does not provide layers in all projections, ``srs`` should be
     *  included in this list. Fallback values are available for ``title`` (the
     *  SOS layer name), ``bbox`` (the map's ``maxExtent`` as array), and
     *  ``srs`` (the map's ``projection``, e.g. "EPSG:4326").
     */

    /** api: property[requiredProperties]
     *  ``Array(String)`` List of config properties that are required for a
     *  complete layer configuration, in addition to ``name``.
     */
    requiredProperties: ["title"],
    /** private: method[constructor]
     */
    constructor: function(config) {
        gxp.plugins.SOSSource.superclass.constructor.apply(this, arguments);
        if (!this.format) {
            this.format = new OpenLayers.Format.SOSCapabilities();
        }
    },
    /** api: method[init]
     *  :arg target: ``Object`` The object initializing this plugin.
     */
    init: function(target) {
        gxp.plugins.SOSSource.superclass.init.apply(this, arguments);
        this.target.on("authorizationchange", this.onAuthorizationChange, this);
    },
    /** private: method[onAuthorizationChange]
     *  Reload the store when the authorization changes.
     */
    onAuthorizationChange: function() {
        if (this.store && this.url.charAt(0) === "/") {
            this.store.reload();
        }
    },
    /** private: method[destroy]
     */
    destroy: function() {
        this.target.un("authorizationchange", this.onAuthorizationChange, this);
        gxp.plugins.SOSSource.superclass.destroy.apply(this, arguments);
    },
    /** api: method[createStore]
     *
     *  Creates a store of layer records.  Fires "ready" when store is loaded.
     */
    createStore: function() {
        var baseParams = this.baseParams || {
            SERVICE: "SOS",
            REQUEST: "GetCapabilities"
        };
        if (this.version) {
            baseParams.VERSION = this.version;
        }

        this.store = new GeoExt.data.SOSCapabilitiesStore({
            // Since we want our parameters (e.g. VERSION) to override any in the 
            // given URL, we need to remove corresponding paramters from the 
            // provided URL.  Simply setting baseParams on the store is also not
            // enough because Ext just tacks these parameters on to the URL - so
            // we get requests like ?Request=GetCapabilities&REQUEST=GetCapabilities
            // (assuming the user provides a URL with a Request parameter in it).
            url: this.trimUrl(this.url, baseParams),
            baseParams: baseParams,
            format: this.format,
            autoLoad: true,
            layerParams: {exceptions: null},
            listeners: {
                load: function() {
                    // The load event is fired even if a bogus capabilities doc 
                    // is read (http://trac.geoext.org/ticket/295).
                    // Until this changes, we duck type a bad capabilities 
                    // object and fire failure if found.
                    if (!this.store.reader.raw || !this.store.reader.raw.service) {
                        this.fireEvent("failure", this, "Invalid capabilities document.");
                    } else {
                        if (!this.title) {
                            this.title = this.store.reader.raw.service.title;
                        }
                        if (!this.ready) {
                            this.ready = true;
                            this.fireEvent("ready", this);
                        }
                    }
                    // clean up data stored on format after parsing is complete
                    delete this.format.data;
                },
                exception: function(proxy, type, action, options, response, error) {
                    delete this.store;
                    var msg, details = "";
                    if (type === "response") {
                        if (typeof error == "string") {
                            msg = error;
                        } else {
                            msg = "Invalid response from server.";
                            // special error handling in IE
                            var data = this.format && this.format.data;
                            if (data && data.parseError) {
                                msg += "  " + data.parseError.reason + " - line: " + data.parseError.line;
                            }
                            var status = response.status;
                            if (status >= 200 && status < 300) {
                                // TODO: consider pushing this into GeoExt
                                var report = error && error.arg && error.arg.exceptionReport;
                                details = gxp.util.getOGCExceptionText(report);
                            } else {
                                details = "Status: " + status;
                            }
                        }
                    } else {
                        msg = "Trouble creating layer store from response.";
                        details = "Unable to handle response.";
                    }
                    // TODO: decide on signature for failure listeners
                    this.fireEvent("failure", this, msg, details);
                    // clean up data stored on format after parsing is complete
                    delete this.format.data;
                },
                scope: this
            }
        });
    },
    /** private: method[trimUrl]
     *  :arg url: ``String``
     *  :arg params: ``Object``
     *
     *  Remove all parameters from the URL's query string that have matching
     *  keys in the provided object.  Keys are compared in a case-insensitive 
     *  way.
     */
    trimUrl: function(url, params, respectCase) {
        var urlParams = OpenLayers.Util.getParameters(url);
        params = OpenLayers.Util.upperCaseObject(params);
        var keys = 0;
        for (var key in urlParams) {
            ++keys;
            if (key.toUpperCase() in params) {
                --keys;
                delete urlParams[key];
            }
        }
        return url.split("?").shift() + (keys ?
                "?" + OpenLayers.Util.getParameterString(urlParams) :
                ""
                );
    },
    /** api: method[createLayerRecord]
     *  :arg config:  ``Object``  The application config for this layer.
     *  :returns: ``GeoExt.data.LayerRecord`` or null when the source is lazy.
     *
     *  Create a layer record given the config. Applications should check that
     *  the source is not :obj:`lazy`` or that the ``config`` is complete (i.e.
     *  configured with all fields listed in :obj:`requiredProperties` before
     *  using this method. Otherwise, it is recommended to use the asynchronous
     *  :meth:`gxp.Viewer.createLayerRecord` method on the target viewer
     *  instead, which will load the source's store to complete the
     *  configuration if necessary.
     */
    createLayerRecord:function (config) {
        var record;

        //create a vector layer based on config parameters
        var layer = new OpenLayers.Layer.Vector(config.name, {
            projection:"projection" in config ? config.projection : "EPSG:4326",
            visibility:"visibility" in config ? config.visibility : true,
            strategies:[new OpenLayers.Strategy.Fixed()],
            protocol:new OpenLayers.Protocol.SOS({
                url:this.url,
                fois: this.getFois()                
                //params:config.params,
                //format:this.getFormat(config)
            }),
            styleMap:this.getStyleMap(config)
        });


        //configure the popup balloons for feed items
        this.configureInfoPopup(layer);

        // create a layer record for this layer
        var Record = GeoExt.data.LayerRecord.create([
            //{name: "title", type: "string"},
            {name:"name", type:"string"},
            {name:"source", type:"string"},
            {name:"group", type:"string"},
            {name:"fixed", type:"boolean"},
            {name:"selected", type:"boolean"},
            {name:"visibility", type:"boolean"},
            {name:"format", type:"string"},
            {name:"defaultStyle"},
            {name:"selectStyle"},
            {name:"params"}
        ]);

        var formatConfig = "format" in config ? config.format : this.format;

        var data = {
            layer:layer,
            //title: config.name,
            name:config.name,
            source:config.source,
            group:config.group,
            fixed:("fixed" in config) ? config.fixed : false,
            selected:("selected" in config) ? config.selected : false,
            params:("params" in config) ? config.params : {},
            visibility:("visibility" in config) ? config.visibility : false,
            format: formatConfig instanceof String ? formatConfig : null,
            defaultStyle:("defaultStyle" in config) ? config.defaultStyle : {},
            selectStyle:("selectStyle" in config) ? config.selectStyle : {}
        };


        record = new Record(data, layer.id);
        return record;

    },
    /** api: method[getProjection]
     *  :arg layerRecord: ``GeoExt.data.LayerRecord`` a record from this
     *      source's store
     *  :returns: ``OpenLayers.Projection`` A suitable projection for the
     *      ``layerRecord``. If the layer is available in the map projection,
     *      the map projection will be returned. Otherwise an equal projection,
     *      or null if none is available.
     *
     *  Get the projection that the source will use for the layer created in
     *  ``createLayerRecord``. If the layer is not available in a projection
     *  that fits the map projection, null will be returned.
     */
    getProjection: function(layerRecord) {
        var projection = this.getMapProjection();
        var compatibleProjection = projection;
        var availableSRS = layerRecord.get("srs");
        if (!availableSRS[projection.getCode()]) {
            compatibleProjection = null;
            var p, srs;
            for (srs in availableSRS) {
                if ((p = new OpenLayers.Projection(srs)).equals(projection)) {
                    compatibleProjection = p;
                    break;
                }
            }
        }
        return compatibleProjection;
    },
    /** api: method[getConfigForRecord]
     *  :arg record: :class:`GeoExt.data.LayerRecord`
     *  :returns: ``Object``
     *
     *  Create a config object that can be used to recreate the given record.
     */
    getConfigForRecord:function (record) {
        // get general config
        var config = gxp.plugins.FeedSource.superclass.getConfigForRecord.apply(this, arguments);
        // add config specific to this source
        return Ext.apply(config, {
            //title: record.get("name"),
            name:record.get("name"),
            group:record.get("group"),
            fixed:record.get("fixed"),
            selected:record.get("selected"),
            params:record.get("params"),
            visibility:record.getLayer().getVisibility(),
            format:record.get("format"),
            defaultStyle:record.getLayer().styleMap["styles"]["default"]["defaultStyle"],
            selectStyle:record.getLayer().styleMap["styles"]["select"]["defaultStyle"]
        });
    },
    
    /* api: method[getFormat]
     *  :arg config:  ``Object``  The application config for this layer.
     *  :returns: ``OpenLayers.Format``
     * Create an instance of the layer's format class and return it
     */
    getFormat:function (config) {
        // get class based on rssFormat in config
        var Class = window;
        var formatConfig = ("format" in config) ? config.format : this.format;

        if (typeof formatConfig == "string" || formatConfig instanceof String) {
            var parts = formatConfig.split(".");
            for (var i = 0, ii = parts.length; i < ii; ++i) {
                Class = Class[parts[i]];
                if (!Class) {
                    break;
                }
            }

            // TODO: consider static method on OL classes to construct instance with args
            if (Class && Class.prototype && Class.prototype.initialize) {

                // create a constructor for the given layer format
                var Constructor = function () {
                    // this only works for args that can be serialized as JSON
                    Class.prototype.initialize.apply(this);
                };
                Constructor.prototype = Class.prototype;

                // create a new layer given format
                var format = new Constructor();
                return format;
            }
        } else {
            return formatConfig;
        }
    },

    /* api: method[configureInfoPopup]
     *  :arg config:  ``Object``  The vector layer
     * Configure a popup to display information on selected feed item.
     */
    configureInfoPopup:function (layer) {
        var tpl = new Ext.XTemplate(this.popupTemplate);
        layer.events.on({
            "featureselected":function (featureObject) {
                var feature = featureObject.feature;
                var pos = feature.geometry;
                if (this.target.selectControl) {
                    if (this.target.selectControl.popup) {
                        this.target.selectControl.popup.close();
                    }
                    this.target.selectControl.popup = new GeoExt.Popup({
                        title:feature.attributes.title,
                        closeAction:'destroy',
                        location:feature,
                        html:tpl.apply(feature.attributes)
                    });
                    this.target.selectControl.popup.show();
                }
            },
            "featureunselected":function () {
                if (this.target.selectControl && this.target.selectControl.popup) {
                    this.target.selectControl.popup.close();
                }
            },
            scope:this
        });
    },

    /* api: method[getStyleMap]
     *  :arg config:  ``Object``  The application config for this layer.
     *  :returns: ``OpenLayers.StyleMap``
     * Return a style map containing default and select styles
     */
    getStyleMap:function (config) {
        return new OpenLayers.StyleMap({
            "default":new OpenLayers.Style("defaultStyle" in config ? config.defaultStyle : {graphicName:"circle", pointRadius:5, fillOpacity:0.7, fillColor:'Red'}, {title:config.name}),
            "select":new OpenLayers.Style("selectStyle" in config ? config.selectStyle : {graphicName:"circle", pointRadius:10, fillOpacity:1.0, fillColor:"Yellow"})
        });
    },
    
    /** private: method[getState] */
    getState: function() {
        var state = gxp.plugins.SOSSource.superclass.getState.apply(this, arguments);
        return Ext.applyIf(state, {title: this.title});
    },
    /** api: method[getFOI]
     *  :arg record: :class:`GeoExt.data.LayerRecord`
     *  :returns: ``Object``
     *
     *  Get the features of interest from the SOS.
     */
    getFois: function() {
        var baseParams = {
            SERVICE: "SOS",
            REQUEST: "GetFeatureOfInterest",
            VERSION: this.version
        };
        var result = [];
                this.offeringCount = 0; 
                for (var name in this.store.contents.offeringList) {
                    var offering = this.store.contents.offeringList[name];
                    this.offeringCount++;
                    for (var i=0, len=offering.featureOfInterestIds.length; i<len; i++) {
                        var foi = offering.featureOfInterestIds[i];
                        if (OpenLayers.Util.indexOf(result, foi) === -1) {
                            result.push(foi);
                        }
                    }
                }
                return result;
    },
    /**
             * Get the title for an ObservedProperty
             */
    getTitleForObservedProperty: function(property) {
        for (var name in this.store.contents.offeringList) {
            var offering = this.store.contents.offeringList[name];
            if (offering.observedProperties[0] === property) {
                return offering.name;
            }
        }
    },
    /** 
     * Get the observation for a given procedure
     * */        
    getObservation: function() {
        
    },
    /** api: method[setFilter]
     *  :arg record: :class:`GeoExt.data.LayerRecord`
     *  :returns: ``Object``
     *
     *  Set a filter to the SOS requests.
     */        
});

Ext.preg(gxp.plugins.SOSSource.prototype.ptype, gxp.plugins.SOSSource);
