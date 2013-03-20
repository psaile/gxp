/**
 * Copyright (c) 2008-2012 The Open Source Geospatial Foundation
 * 
 * Published under the BSD license.
 * See http://svn.geoext.org/core/trunk/geoext/license.txt for the full text
 * of the license.
 */

/**
 * @include GeoExt/data/SOSCapabilitiesReader.js
 */

/** api: (define)
 *  module = GeoExt.data
 *  class = SOSCapabilitiesStore
 *  base_link = `Ext.data.Store <http://dev.sencha.com/deploy/dev/docs/?class=Ext.data.Store>`_
 */


Ext.ns("GeoExt.data");

GeoExt.data.SOSCapabilitiesStore = function(meta) {
    meta = meta || {};
    
    meta.format = new OpenLayers.Format.SOSCapabilities();
    //meta.format.write(meta.opts);
    meta.fields = [
            {name: "capabilities"} // root capabilities object
    ];
    GeoExt.data.SOSCapabilitiesStore.superclass.constructor.call(
        this,
        Ext.apply(meta, {
            proxy: meta.proxy || (!meta.data ? new Ext.data.HttpProxy({url: meta.url, disableCaching: false, method: "GET"}) : undefined),
            baseParams : meta.baseParams || { xmlData : meta.format.write(meta.opts) },
            reader: new GeoExt.data.SOSCapabilitiesReader(meta)
        })
    );
};

Ext.extend(GeoExt.data.SOSCapabilitiesStore, Ext.data.Store);
