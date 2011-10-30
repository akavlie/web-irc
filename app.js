$(function() {

    // socket.io init
    var socket = io.connect('http://localhost');


    // MODELS & COLLECTIONS
    // ====================
    var Message = Backbone.Model.extend({
        // expected properties:
        // - sender
        // - text
    });

    var Stream = Backbone.Collection.extend({
        model: Message
    });

    var Person = Backbone.Model.extend({
    });

    var Participants = Backbone.Collection.extend({
        model: Person
    });

    // temporary -- hardcoding to correspond with server
    // TODO -- do this better
    var me = new Person({nick: 'aktest'});

    var Frame = Backbone.Model.extend({
        // expected properties:
        // - id
        default: { 'type': 'frame'},
        initialize: function() {
            this.stream = new Stream;
            this.participants = new Participants;
        },

        setActive: function() {
            console.log('Setting ' + this.get('id') + ' as the active frame.')
            // More stuff will go here
        },

        part: function() {
            console.log('Leaving ' + this.get('id'));
            socket.emit('part', this.get('id'));
            this.destroy();
        }

    });

    var FrameList = Backbone.Collection.extend({ model: Frame });

    window.frames = new FrameList;


    // VIEWS
    // =====
    var MessageView = Backbone.View.extend({

    	render: function() {
            var msg = this.model.get('sender') + ': ' + this.model.get('text');
            $(this.el).html(msg);
            return this;
    	}
    });

    var FrameView = Backbone.View.extend({
        el: $('.frame'),

        initialize: function() {
            // frame.bind('add', this.focus, this);
            _.bindAll(this);
        },

    	addMessage: function(message) {
           var view = new MessageView({model: message});
           this.$('.output').append(view.render().el);
    	},

        addNick: function(person) {
            // TODO: Use a template here!
            this.$('.nicks').append('<div>' + person.get('opStatus') + person.get('nick') + '</div>');
        },

        // Switch focus to a different frame
        focus: function(frame) {
            console.log('Focusing frame ' + frame.get('id'));
            this.focused = frame;
            this.$('.output').empty();
            this.$('.nicks').empty();

            frame.stream.each(this.addMessage);
            frame.participants.each(this.addNick);
            if (frame.get('id') == 'status')
                this.$('.nicks').hide();
            else
                this.$('.nicks').show();

            // Only the selected frame should send messages
            frames.each(function(frm) {
                frm.stream.unbind('add');
                frm.participants.unbind('add');
            });
            frame.stream.bind('add', this.addMessage, this);
            frame.participants.bind('add', this.addNick, this);
        },

        updateNicks: function(model, nicks) {
            console.log('Nicks rendered');
        }
    });

    var FrameTabView = Backbone.View.extend({
        tagName: 'li',
        tmpl: '<span class="name">{{ text }}</span> <span class="close"></span>',

        initialize: function() {
            this.render();
        },

        events: {
            'click': 'setActive',
            'click .close': 'part'
        },

        part: function() {
            this.model.part();
            $(this.el).remove();
        },

        // Set as active tab; focus window on frame
        setActive: function() {
            console.log('View setting active status');
            $(this.el).addClass('active')
                .siblings().removeClass('active');
            frameWindow.focus(this.model);
        },

        render: function() {
            console.log('Rendering frame tab');
            
            var html = Mustache.to_html(this.tmpl, {text: this.model.get('id')});
            $(this.el).html(html);
            return this;
        }

        
    });

    var AppView = Backbone.View.extend({
        el: $('#content'),
        testFrames: $('#sidebar .frames'),
        frameList: $('header .frames'),

        initialize: function() {
            frames.bind('add', this.addTab, this);
            this.input = this.$('#prime-input');
            this.render();
        },

        events: {
            'keypress #prime-input': 'parseInput'
        },

        addTab: function(frame) {
            var tab = new FrameTabView({model: frame});
            this.frameList.append(tab.el);
            tab.setActive();
        },

        joinChannel: function(name) {
            socket.emit('join', name);
        },

        // Should be launch point for parsing / commands and such
        // in due time
        parseInput: function(e) {
            if (e.keyCode != 13) return;
            var frame = frameWindow.focused;
            if (this.input.val().trim().indexOf('/') === 0) {
                console.log('IRC command detected -- sending to server');
                socket.emit('command', this.input.val().trim().substr(1));
            } else {
                socket.emit('say', {
                    target: frame.get('id'),
                    message: this.input.val()
                });
                frame.stream.add({sender: msg.from, text: msg.text});
            }

            this.input.val('');
        },

        render: function() {
            // Dynamically assign height
            $(window).resize(function() {
                sizeContent($('.frame .output'));
                sizeContent($('.frame .nicks'));
            });
        }

    });

    var frameWindow = new FrameView,
        app = new AppView;
    
    // Create the status "frame"
    frames.add({id: 'status', type: 'status'});

    // Set output window to full height, minus other elements
    function sizeContent(sel) {
        var newHeight = $('html').height() - $('header').outerHeight(true) - 
                        $('#prime-input').outerHeight(true) - 
                        (sel.outerHeight(true) - sel.height()) - 10;
                        // (10 = #content padding)
        sel.height(newHeight);
    } 

    sizeContent($('.frame .output'));
    sizeContent($('.frame .nicks'));

    // VERY TEMPORARY -- JUST FOR TESTING
    $('#sidebar .frames li').click(function() {
        var name = $(this).text();
        app.joinChannel(name);
    });

    $('#sidebar .frames li .close').click(function() {
        var name = $(this).parent().text();
        console.log('Leaving ' + name);
        socket.emit('leave', {name: name})
    });



    socket.on('message', function(msg) {
        frame = frames.get(msg.to);
        if (frame) {
        	frame.stream.add({sender: msg.from, text: msg.text});
        }
    });

    socket.on('motd', function(data) {
        data.motd.split('\n').forEach(function(line) {
            frames.get('status').stream.add({sender: '', text: line});
        });
    });

    socket.on('join', function(data) {
        console.log('Join event received for ' + data.channel + ' - ' + data.nick);
        if (data.nick == me.get('nick')) {
            frames.add({id: data.channel});
        }
    });

    socket.on('names', function(data) {
        frame = frames.get(data.channel);
        console.log(data.nicks);
        console.log(frame);
        for (var nick in data.nicks) {
            frame.participants.add({nick: nick, opStatus: data.nicks[nick]});
        }
    });

});