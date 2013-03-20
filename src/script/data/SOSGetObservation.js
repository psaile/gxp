/* Copyright (c) 2006-2011 by OpenLayers Contributors (see authors.txt for 
 * full list of contributors). Published under the Clear BSD license.  
 * See http://svn.openlayers.org/trunk/openlayers/license.txt for the
 * full text of the license. */

/**
 * @requires OpenLayers/Format/XML.js
 * @requires OpenLayers/Format/SOSGetFeatureOfInterest.js
 */

/**
 * Class: OpenLayers.Format.SOSGetObservation
 * Read and write SOS GetObersation (to get the actual values from a sensor) 
 *     version 1.0.0
 *
 * Inherits from:
 *  - <OpenLayers.Format.XML>
 */
OpenLayers.Format.SOSGetObservation = OpenLayers.Class(OpenLayers.Format.XML, {
    
    /**
     * Property: namespaces
     * {Object} Mapping of namespace aliases to namespace URIs.
     */
    namespaces: {
        ows: "http://www.opengis.net/ows",
        gml: "http://www.opengis.net/gml",
        sos: "http://www.opengis.net/sos/1.0",
        ogc: "http://www.opengis.net/ogc",
        om: "http://www.opengis.net/om/1.0",
        om2: "http://www.opengis.net/om/2.0",
        swe: "http://www.opengis.net/swe/1.0",
        sa: "http://www.opengis.net/sampling/1.0",
        wml2: "http://www.opengis.net/waterml/2.0",
        xlink: "http://www.w3.org/1999/xlink",
        xsi: "http://www.w3.org/2001/XMLSchema-instance"
    },

    /**
     * Property: regExes
     * Compiled regular expressions for manipulating strings.
     */
    regExes: {
        trimSpace: (/^\s*|\s*$/g),
        removeSpace: (/\s*/g),
        splitSpace: (/\s+/),
        trimComma: (/\s*,\s*/g)
    },

    /**
     * Constant: VERSION
     * {String} 1.0.0
     */
    VERSION: "1.0.0",

    /**
     * Property: schemaLocation
     * {String} Schema location
     */
    schemaLocation: "http://www.opengis.net/sos/1.0 http://schemas.opengis.net/sos/1.0.0/sosGetObservation.xsd",

    /**
     * Property: defaultPrefix
     */
    defaultPrefix: "sos",

    /**
     * Constructor: OpenLayers.Format.SOSGetObservation
     *
     * Parameters:
     * options - {Object} An optional object whose properties will be set on
     *     this instance.
     */

    /**
     * Method: read
     * 
     * Parameters: 
     * data - {String} or {DOMElement} data to read/parse.
     *
     * Returns:
     * {Object} An object containing the measurements
     */
    read: function(data) {
        if(typeof data == "string") {
            data = OpenLayers.Format.XML.prototype.read.apply(this, [data]);
        }
        if(data && data.nodeType == 9) {
            data = data.documentElement;
        }
        var info = {};
        this.readNode(data, info);
        return info;
    },

    /**
     * Method: write
     *
     * Parameters:
     * options - {Object} Optional object.
     *
     * Returns:
     * {String} An SOS GetObservation request XML string.
     */
    write: function(options) {
        var node = this.writeNode("sos:GetObservation", options);
        node.setAttribute("xmlns:om", this.namespaces.om);
        node.setAttribute("xmlns:ogc", this.namespaces.ogc);
        this.setAttributeNS(
            node, this.namespaces.xsi,
            "xsi:schemaLocation", this.schemaLocation
        );
        return OpenLayers.Format.XML.prototype.write.apply(this, [node]);
    }, 

    /**
     * Property: readers
     * Contains public functions, grouped by namespace prefix, that will
     *     be applied when a namespaced node is found matching the function
     *     name.  The function will be applied in the scope of this parser
     *     with two arguments: the node being read and a context object passed
     *     from the parent.
     */
    readers: {
        "om": {
            "ObservationCollection": function(node, obj) {
                obj.id = this.getAttributeNS(node, this.namespaces.gml, "id");
                obj.measurements = [];
                obj.observations = [];
                obj.attributes = [];
                this.readChildNodes(node, obj);
            },
            "member": function(node, observationCollection) {
                this.readChildNodes(node, observationCollection);
            },
            "Measurement": function(node, observationCollection) {
                var measurement = {};
                observationCollection.measurements.push(measurement);
                this.readChildNodes(node, measurement);
            },
            "Observation": function(node, observationCollection) {
                var observation = {
                    attributes: {}
                };
                observationCollection.observations.push(observation);
                this.readChildNodes(node, observation);
            },
            "samplingTime": function(node, measurement) {
                var samplingTime = {};
                measurement.samplingTime = samplingTime;
                this.readChildNodes(node, samplingTime);
            },
            "observedProperty": function(node, measurement) {
                measurement.observedProperty = 
                    this.getAttributeNS(node, this.namespaces.xlink, "href");
                this.readChildNodes(node, measurement);
            },
            "procedure": function(node, measurement) {
                measurement.procedure = 
                    this.getAttributeNS(node, this.namespaces.xlink, "href");
                this.readChildNodes(node, measurement);
            },
            "featureOfInterest": function(node, observation) {
                var foi = {features: []};
                observation.fois = [];
                observation.fois.push(foi);
                this.readChildNodes(node, foi);
                // postprocessing to get actual features
                var features = [];
                for (var i=0, len=foi.features.length; i<len; i++) {
                    var feature = foi.features[i];
                    features.push(new OpenLayers.Feature.Vector(
                        feature.components[0], feature.attributes));
                }
                foi.features = features;
            },
            "result": function(node, measurement) {
                var result = {};
                measurement.result = result;
                var childValue = this.getChildValue(node);
                if (childValue && !/^\s*$/.test(childValue)) {
                    result.value = this.getChildValue(node);
                    result.uom = node.getAttribute("uom");
                } else {
                    this.readChildNodes(node, result);
                }
            }
        },
        "om2": OpenLayers.Util.applyDefaults({
            "OM_Observation": function(node, obj) {
                var observation = {
                    attributes: {}
                };
                obj.observations.push(observation);
                this.readChildNodes(node, observation);
            },
            "metadata": function(node, obj) {
                this.readChildNodes(node, obj);
            }
        }, OpenLayers.Format.SOSGetObservation.prototype.readers.om),
        "sa": OpenLayers.Format.SOSGetFeatureOfInterest.prototype.readers.sa,
        "gml": OpenLayers.Util.applyDefaults({
            "TimeInstant": function(node, samplingTime) {
               var timeInstant = {};
                samplingTime.timeInstant = timeInstant;
                this.readChildNodes(node, timeInstant);
            },
            "timePosition": function(node, timeInstant) {
                timeInstant.timePosition = this.getChildValue(node);
            },
            "description": function(node, obj) {
                obj.description = this.getChildValue(node);
            }
        }, OpenLayers.Format.SOSGetFeatureOfInterest.prototype.readers.gml),
        "swe": {
            "DataArray": function(node, obj) {
                var dataArray = {};
                obj.dataArray = dataArray;
                this.readChildNodes(node, dataArray);
            },
            "elementCount": function(node, dataArray) {
                this.readChildNodes(node, dataArray);
            },
            "Count": function(node, dataArray) {
                var count = undefined;
                this.readChildNodes(node, count);
                dataArray.count = count;
            },
            "value": function(node, obj) {
                var value = this.getChildValue(node);
                obj = value;
            },
            "elementType": function(node, dataArray) {
                var name = node.getAttribute("name");
                dataArray.elementType = name;
                this.readChildNodes(node, dataArray);
            },
            "DataRecord": function(node, dataArray) {
                var dataRecord = [];
                dataArray.dataRecord = dataRecord;
                this.readChildNodes(node, dataRecord);
            },
            "field": function(node, dataRecord) {
                var field = {};
                var name = node.getAttribute("name");
                field.name = name;
                dataRecord.push(field);
                this.readChildNodes(node, field);
            },
            "Time": function(node, field) {
                var def = node.getAttribute("definition");
                field.def = def;
            },
            "Quantity": function(node, field) {
                var def = node.getAttribute("definition");
                field.def = def;
                this.readChildNodes(node, field);
            },
            "uom": function(node, field) {
                var uom = node.getAttribute("code");
                field.uom = uom;
            },
            "encoding": function(node, dataArray) {
                var encoding = {};
                dataArray.encoding = encoding;
                this.readChildNodes(node, encoding);
            },
            "TextBlock": function(node, encoding) {
                var blockSeparator = node.getAttribute("blockSeparator");
                var decimalSeparator = node.getAttribute("decimalSeparator");
                var tokenSeparator = node.getAttribute("tokenSeparator");
                encoding.blockSeparator = blockSeparator;
                encoding.decimalSeparator = decimalSeparator;
                encoding.tokenSeparator = tokenSeparator;
            },
            "values": function(node, dataArray) {
                var values = [];
                dataArray.values = values;
                var encodedValues = this.getChildValue(node).trim();
                var blocks = encodedValues.split(dataArray.encoding.blockSeparator);
                for (var i = 0, len = blocks.length;i < len;i++) {
                    values.push(blocks[i].split(dataArray.encoding.tokenSeparator));
                }
            }
        },
        "wml2": {
            "Collection": function(node, obj) {
                obj.id = this.getAttributeNS(node, this.namespaces.gml, "id");
                obj.observations = [];
                obj.measurements = [];
                obj.attributes = [];
                this.readChildNodes(node, obj);
            },
            "metadata": function(node, obj) {
                var metadata = {};
                obj.metadata = metadata;
                this.readChildNodes(node, metadata);
            },
            "DocumentMetadata": function(node, obj) {
                obj.id = this.getAttributeNS(node, this.namespaces.gml, "id");
                this.readChildNodes(node, obj);
            },
            "generationDate": function(node, obj) {
                obj.generationDate = this.getChildValue(node);
                this.readChildNodes(node, obj);
            },
            "version": function(node, obj) {
                obj.version = this.getAttributeNS(node, this.namespaces.xlink, "title");
            },
            "observationMember": function(node, obj) {
                this.readChildNodes(node, obj);
            },
            "ObservationMetadata": function(node, obj) {
                // need to build in gmd/gco for some of these children
                this.readChildNodes(node, obj);
            },
            "MonitoringPoint": function(node, obj) {
                this.readChildNodes(node, obj);
            },
            "descriptionReference": function(node, obj) {
                obj.reference = this.getAttributeNS(node, this.namespaces.xlink, "href");
                this.readChildNodes(node, obj);
            },
            "timeZone": function(node, obj) {
                this.readChildNodes(node, obj);
            },
            "TimeZone": function(node, obj) {
                var tz = obj.timezone = {};
                this.readChildNodes(node, tz);
            },
            "zoneOffset": function(node, obj) {
                obj.offset = this.getChildValue(node);
            },
            "zoneAbbreviation": function(node, obj) {
                obj.abbr = this.getChildValue(node);
            },
            "MeasurementTimeseries": function(node, obj) {
                obj.measurements = [];
                this.readChildNodes(node, obj);
            },
            "TimeSeriesMetadata": function(node, obj) {
                this.readChildNodes(node, obj);
            },
            "temporalExtent": function(node, obj) {
                this.readChildNodes(node, obj);
            },
            "defaultPointMetadata": function(node, obj) {
                this.readChildNodes(node, obj);
            },
            "DefaultTVPMeasurementMetadata": function(node, obj) {
                var defaultMeta = {};
                obj.metadata['default'] = defaultMeta;
                this.readChildNodes(node, defaultMeta);
            },
            "qualifier": function(node, obj) {
                obj.qualifier = this.getAttributeNS(node, this.namespaces.xlink, "title");
            },
            "uom": function(node, obj) {
                obj.uom = node.getAttribute("code");
            },
            "interpolationType": function(node, obj) {
                var interpolationType = {};
                interpolationType.href = this.getAttributeNS(node, this.namespaces.xlink, "href");
                interpolationType.title = this.getAttributeNS(node, this.namespaces.xlink, "title");
                obj.interpolationType = interpolationType;
            },
            "point": function(node, obj) {
                var point = {};
                obj.measurements.push(point);
                this.readChildNodes(node, point);
            },
            "MeasurementTVP": function(node, obj) {
                this.readChildNodes(node, obj);
            },
            "time": function(node, obj) {
                obj.time = this.getChildValue(node);
            },
            "value": function(node, obj) {
                obj.value = this.getChildValue(node);
            },
            "TVPMeasurementMetadata": function(node, obj) {
                this.readChildNodes(node, obj);
            },
            "comment": function(node, obj) {
                obj.comment = this.getChildValue(node);
            }
        }
    },

    /**
     * Property: writers
     * As a compliment to the readers property, this structure contains public
     *     writing functions grouped by namespace alias and named like the
     *     node names they produce.
     */
    writers: {
        "sos": {
            "GetObservation": function(options) {
                var node = this.createElementNSPlus("GetObservation", {
                    attributes: {
                        version: this.VERSION,
                        service: 'SOS'
                    } 
                }); 
                this.writeNode("offering", options, node);
                if (options.eventTime) {
                    this.writeNode("eventTime", options, node);
                }
                for (var procedure in options.procedures) {
                    this.writeNode("procedure", options.procedures[procedure], node);
                }
                for (var observedProperty in options.observedProperties) {
                    if (options.observedProperties.hasOwnProperty(observedProperty)) {
                        this.writeNode("observedProperty", options.observedProperties[observedProperty], node);
                    }
                }
                if (options.foi) {
                    this.writeNode("featureOfInterest", options.foi, node);
                }
                this.writeNode("responseFormat", options, node);
                if (options.resultModel) {
                    this.writeNode("resultModel", options, node);
                }
                if (options.responseMode) {
                    this.writeNode("responseMode", options, node);
                }
                return node; 
            },
            "featureOfInterest": function(foi) {
                var node = this.createElementNSPlus("featureOfInterest");
                this.writeNode("ObjectID", foi.objectId, node);
                return node;
            },
            "ObjectID": function(options) {
                return this.createElementNSPlus("ObjectID",
                    {value: options});
            },
            "responseFormat": function(options) {
                return this.createElementNSPlus("responseFormat", 
                    {value: options.responseFormat});
            },
            "procedure": function(procedure) {
                return this.createElementNSPlus("procedure", 
                    {value: procedure});
            },
            "offering": function(options) {
                return this.createElementNSPlus("offering", {value: 
                    options.offering});
            },
            "observedProperty": function(observedProperty) {
                return this.createElementNSPlus("observedProperty", 
                    {value: observedProperty});
            },
            "eventTime": function(options) {
                var node = this.createElementNSPlus("eventTime");
                if (options.eventTime === 'latest') {
                    this.writeNode("ogc:TM_Equals", options, node);
                }
                return node;
            },
            "resultModel": function(options) {
                return this.createElementNSPlus("resultModel", {value: 
                    options.resultModel});
            },
            "responseMode": function(options) {
                return this.createElementNSPlus("responseMode", {value: 
                    options.responseMode});
            }
        },
        "ogc": {
            "TM_Equals": function(options) {
                var node = this.createElementNSPlus("ogc:TM_Equals");
                this.writeNode("ogc:PropertyName", {property: 
                    "urn:ogc:data:time:iso8601"}, node);
                if (options.eventTime === 'latest') {
                    this.writeNode("gml:TimeInstant", {value: 'latest'}, node);
                }
                return node;
            },
            "PropertyName": function(options) {
                return this.createElementNSPlus("ogc:PropertyName", 
                    {value: options.property});
            }
        },
        "gml": {
            "TimeInstant": function(options) {
                var node = this.createElementNSPlus("gml:TimeInstant");
                this.writeNode("gml:timePosition", options, node);
                return node;
            },
            "timePosition": function(options) {
                var node = this.createElementNSPlus("gml:timePosition", 
                    {value: options.value});
                return node;
            }
        }
    },
    
    CLASS_NAME: "OpenLayers.Format.SOSGetObservation" 

});
