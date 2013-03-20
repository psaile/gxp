/**
 * Copyright (c) 2008-2012 The Open Source Geospatial Foundation
 * 
 * Published under the BSD license.
 * See http://svn.geoext.org/core/trunk/geoext/license.txt for the full text
 * of the license.
 */

/**
 * @include GeoExt/data/LayerRecord.js
 * @require OpenLayers/Format/SOSCapabilities.js
 * @require OpenLayers/Format/SOSCapabilities/v1_1_1.js
 * @require OpenLayers/Util.js
  * @require OpenLayers/Protocol/SOS.js
 * @require OpenLayers/Protocol/SOS/v1_0_0.js
 * @require OpenLayers/Strategy/Fixed.js
 * @require OpenLayers/Layer/Vector.js
 */

/** api: (define)
 *  module = GeoExt.data
 *  class = SOSCapabilitiesReader
 *  base_link = `Ext.data.DataReader <http://dev.sencha.com/deploy/dev/docs/?class=Ext.data.DataReader>`_
 */


Ext.namespace("GeoExt.data");

GeoExt.data.SOSCapabilitiesReader = function(meta, recordType) {
    meta = meta || {};
    if(!meta.format) {
        meta.format = new OpenLayers.Format.SOSCapabilities();
    }
    if(typeof recordType !== "function") {
        recordType = Ext.data.Record.create(meta.fields || [
            {name: "capabilities"} // Array of objects
        ]
        );
    }
    GeoExt.data.SOSCapabilitiesReader.superclass.constructor.call(
        this, meta, recordType
    );
};

Ext.extend(GeoExt.data.SOSCapabilitiesReader, Ext.data.DataReader, {


    /** api: config[attributionCls]
     *  ``String`` CSS class name for the attribution DOM elements.
     *  Element class names append "-link", "-image", and "-title" as
     *  appropriate.  Default is "gx-attribution".
     */
    attributionCls: "gx-attribution",

    /** private: method[read]
     *  :param request: ``Object`` The XHR object which contains the parsed XML
     *      document.
     *  :return: ``Object`` A data block which is used by an ``Ext.data.Store``
     *      as a cache of ``Ext.data.Record`` objects.
     */
    read: function(request) {
        var data = request.responseXML;
        if(!data || !data.documentElement) {
            data = request.responseText;
        }
        return this.readRecords(data);
    },
    

    /** private: method[readRecords]
     *  :param data: ``DOMElement | String | Object`` A document element or XHR
     *      response string.  As an alternative to fetching capabilities data
     *      from a remote source, an object representing the capabilities can
     *      be provided given that the structure mirrors that returned from the
     *      capabilities parser.
     *  :return: ``Object`` A data block which is used by an ``Ext.data.Store``
     *      as a cache of ``Ext.data.Record`` objects.
     *  
     *  Create a data block containing Ext.data.Records from an XML document.
     */
    readRecords: function(data) {
        if (typeof data === "string" || data.nodeType) {
            data = this.meta.format.read(data);
        }
        
        var records = [];

        Ext.iterate(data.observations, function (item) {
            var values = {};
            values.capabilities = item.capabilities;

            records.push(new this.recordType(values));
        }, this);
        
        return {
            totalRecords: records.length,
            success: true,
            records: records
        };

    }

});
