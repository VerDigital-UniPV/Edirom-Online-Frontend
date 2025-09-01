/**
 *  Edirom Online
 *  Copyright (C) 2014 The Edirom Project
 *  http://www.edirom.de
 *
 *  Edirom Online is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  Edirom Online is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with Edirom Online.  If not, see <http://www.gnu.org/licenses/>.
 */
Ext.define('EdiromOnline.view.window.source.AlternativesVerovioView', {
    extend: 'EdiromOnline.view.window.View',
    
    requires:[
    'EdiromOnline.view.window.image.AlternativesVerovioImage'],
    
    alias: 'widget.alternativesVerovioView',
    
    layout: 'border',
    
    border: 0,
    bottomBar: null,
    
    verovioImageView: null,
    
    cls: 'alternativesVerovioView',
    
    initComponent: function () {
        
        var me = this;
        
        me.addEvents(
        'gotoMeasure',
        'gotoMeasureByName');
        
        me.verovioImageView = Ext.create('EdiromOnline.view.window.image.AlternativesVerovioImage');
        me.viewerContainer = Ext.create('Ext.panel.Panel', {
            region: 'center',
            border: 0,
            layout: 'card',
            items:[me.verovioImageView]
        });
        
        me.items =[
        me.viewerContainer];
        
        me.callParent();
        
        me.on('afterrender', me.createMenuEntries, me, {
            single: true
        });
    },
    
    setIFrameContent: function (uri, edition) {
        var me = this;
        me.verovioImageView.setIFrameContent(uri, edition);
    },
    
    createMenuEntries: function () {
        
        var me = this;
        
        me.gotoMenu = Ext.create('Ext.button.Button', {
            text: getLangString('view.window.source.SourceView_gotoMenu'),
            indent: false,
            cls: 'menuButton',
            menu: {
                items:[ {
                    id: me.id + '_gotoMeasure',
                    text: getLangString('view.window.source.SourceView_gotoMeasure'),
                    handler: Ext.bind(me.gotoMeasureDialog, me)
                }]
            }
        });
        me.window.getTopbar().addViewSpecificItem(me.gotoMenu, me.id);

        me.alternativesPreferencesMenu = Ext.create('Ext.button.Button', {
            text: 'Load custom version',
            indent: false,
            cls: 'menuButton',
            menu: {
                items:[]
            }
        });
        me.window.getTopbar().addViewSpecificItem(me.alternativesPreferencesMenu, me.id);

        me.savePreferencesButton = Ext.create('Ext.button.Button', {
            id: me.id + '_newAlternativesPreference',
            text: 'Save customized version',
            indent: false,
            cls: 'menuButton',
            handler: Ext.bind(me.saveAlternativesPreferenceDialog, me)
        });
        me.window.getTopbar().addViewSpecificItem(me.savePreferencesButton, me.id);
    },
    
    setMovements: function (movements) {
        var me = this;

        // set me.movements to submitted JSON array
        me.movements = movements;

        // initialize movementItems variable
        var movementItems =[];

        // iterate over submitted movements and push them to movementItems variable
        movements.each(function (movement) {
            movementItems.push({
                text: movement. get ('name'),
                handler: Ext.bind(me.showMovement, me, movement. get ('id'), true)
            });
        });

        // check if contains more than one item and save to variable as boolean
        var isDisabled = ((movementItems.length <= 1) ? true : false);

        // add gotoMovement entry to goto menu
        me.gotoMenu.menu.add({
            id: me.id + '_gotoMovement',
            text: getLangString('view.window.source.SourceView_gotoMovement'),
            cls: 'gotoMovement',
            disabled: isDisabled,
            disabledCls: 'x-disabled',
            menu: {
                items: movementItems
            }
        });      
    },

    setPreferences: function (preferences) {
        var me = this;

        // set me.preferences to submitted JSON array
        me.preferences = preferences;

        // initialize preferencesItems variable
        var preferencesItems = [];

        // iterate over submitted preferences and push them to preferencesItems variable
        preferences.each(function (preference) {
            preferencesItems.push({
                text: preference.get('name'),
                handler: Ext.bind(me.setAlternativePreferences, me, preference.get('query'), true)
            });
        });

        // add gotoMovement entry to goto menu
        me.alternativesPreferencesMenu.menu.add(preferencesItems);
    }, 
    
    showMovement: function (menuItem, event, movementId) {
        var me = this;
        me.verovioImageView.showMovement(movementId);
    },

    setAlternativePreferences: function (menuItem, event, query) {
        var me = this;
        // TODO
    },
    
    gotoMeasureDialog: function () {
        var me = this;
        
        Ext.create('EdiromOnline.view.window.source.GotoMsg', {
            movements: me.movements,
            callback: Ext.bind(function (measure, movementId) {
                this.fireEvent('gotoMeasureByName', this, measure, movementId);
            },
            me)
        }).show();
    },

    saveAlternativesPreferenceDialog: function () {
        var me = this;
        
        Ext.create('EdiromOnline.view.window.source.SaveAlternativesPreference', {
            movements: me.movements,
            callback: Ext.bind(function (measure, movementId) {
                this.fireEvent('gotoMeasureByName', this, measure, movementId);
            },
            me)
        }).show();
    },

    /* 
     * Call showMeasure of corresponding VerovioImageView.
     * @param {string} movementId - The XML-ID of the selected movement.
     * @param {string} measureId - The XML-ID of the selected measure.
     * @param {number} measureCount - The number of measures to be displayed [currently ignored in VerovioView].
     */
    showMeasure: function(movementId, measureId, measureCount){
        var me = this;
        me.verovioImageView.showMeasure(movementId, measureId);
    }
});

Ext.define('EdiromOnline.view.window.source.SaveAlternativesPreference', {

    extend: 'Ext.window.Window',

    requires: [
        'Ext.form.field.Text',
        'Ext.form.ComboBox',
    ],

	cls: 'gotoDialogue',
	bodyBorder: false,
	
    height: 140,
    width: 320,

    modal: true,
    resizable: false,

    layout: {
        type: 'vbox',
        align: 'stretch',
        padding: 5
    },

    padding: 0,

    initComponent: function() {
        var me = this;

        Ext.apply(me, me.config);

        me.title = 'Save this selection'; //getLangString('view.window.source.SourceView_GotoMsg_Title');

        me.field = Ext.create('Ext.form.field.Text', {
            name: 'name',
            fieldLabel: 'Preference Name', //getLangString('view.window.source.SourceView_GotoMsg_Measure'),
            allowBlank: false
        });

        me.aboutButton = Ext.create('Ext.button.Button', {
            id: 'savePreferenceBtn',
            cls: 'saveButton',
            text: 'Save', //getLangString('view.desktop.TaskBar_about'),
            action: 'openAboutWindow' // TODO: like me.gotoFn
        });

        me.items = [
            me.field, me.aboutButton,
            {
                xtype: 'panel',
                layout: 'hbox',
                items: [
                    { xtype: 'component', flex: 1 },
                    {
                        text: getLangString('global_cancel'),
                        handler: me.close,
                        scope: me
                    },
                    {
                        text: getLangString('global_execute'),
                        handler: me.gotoFn,
                        scope: me
                    }
                ]
            }
        ];

        me.callParent();

        me.on('afterrender', me.initKeys, me, {single: true});
    },

    initKeys: function() {
        var me = this;
        var map = me.getKeyMap();

        map.addBinding({
            key: Ext.EventObject.ENTER,
            fn: me.gotoFn,
            scope: me
        });

        map.addBinding({
            key: Ext.EventObject.ESC,
            fn: me.close,
            scope: me
        });

        map.enable();
    },

    gotoFn: function(button, event) {
        var me = this;

        //TODO: Validierung
        me.callback(Ext.String.trim(me.field.getValue()));
        me.close();
    }
});