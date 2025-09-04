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
Ext.define('EdiromOnline.controller.window.pdf.PDFWindow', {

    extend: 'Ext.app.Controller',

    views: [
        'window.pdf.PDFWindow'
    ],

    init: function() {
        this.control({
            'PDFWindow': {
               afterlayout : this.onAfterLayout
            }
        });
    },

    onAfterLayout: function(view) {

        var me = this;

        edition = this.application.activeEdition;
        workId = this.application.activeWork;

        window.doAJAXRequest('data/xql/getWorks.xql',
            'GET', 
            {
                editionId: edition,
            },
            Ext.bind(function(response){
                const jsonResponse = JSON.parse(response.responseText)
                console.log(jsonResponse)
                const element = jsonResponse.find(item => item.id === workId);
                this.workUri = element ? element.doc : null;
            }, this),
            2, // retries
            false // async
        );

        console.log(this.workUri)

        var html = `<html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>PDF Window</title>
                    <script src="https://www.verovio.org/javascript/latest/verovio-toolkit-wasm.js" defer></script>
                    <script type="text/javascript" src="resources/js/pdf-window.js" defer></script>
                    <link rel="stylesheet" type="text/css" href="resources/css/pdf-window.css">
                </head>
                <body>
                    <div class="container">
                        <div id="content">
                            <div class="tei_body">
                                <h1>Loading Numbers...</h1>
                                <section class="teidiv0">
                                    <p>Please wait while we fetch the available numbers and versions.</p>
                                </section>
                            </div>
                        </div>
                        
                        <div id="status" class="status" style="display: none;"></div>
                        
                        <div id="progressContainer" class="progress-container">
                            <div id="progressBar" class="progress-bar"></div>
                        </div>
                        
                        <div id="scoresContainer" class="scores-container"></div>
                        
                        <script>
                            var edition = "${edition}";
                            var workUri = "${this.workUri}";
                            var appBasePath = "@backend.url@";
                        </script>
                    </div>
                </body>
            </html>`;

        view.setResult(html);

        if(view.initialized) return;
        view.initialized = true;

    }
});
