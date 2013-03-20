Ext.ns("GeoExt.data");

GeoExt.data.SOSObservationStore = function(meta) {
    meta = meta || {};
    
    meta.format = new OpenLayers.Format.SOSGetObservation();
    //meta.format.write(meta.opts);
    meta.fields = [
            {name: "id", type: "string"},
            {name: "name", type: "string"},
            {name: "bounds"}, // Object
            {name: "fois"}, // Array of objects
            {name: "dataRecord"}, // Array of objects
            {name: "values"} // Array of objects
    ]
    GeoExt.data.SOSObservationStore.superclass.constructor.call(
        this,
        Ext.apply(meta, {
            proxy: meta.proxy || (!meta.data ? new Ext.data.HttpProxy({url: meta.url, disableCaching: false, method: "POST"}) : undefined),
            baseParams : meta.baseParams || { xmlData : meta.format.write(meta.opts) },
            reader: new GeoExt.data.ObservationReader(meta)
        })
    );
};

Ext.extend(GeoExt.data.SOSObservationStore, Ext.data.Store);
