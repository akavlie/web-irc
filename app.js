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

    var Channel = Backbone.Model.extend({
        // expected properties:
        // - id
        initialize: function() {
            this.stream = new Stream;
            this.participants = new Participants;
            // Only join true channels
            if (this.get('id').indexOf('#') == 0) {
                console.log('Joining ' + this.get('id'));
            }
        },

        setActive: function() {
            console.log('Setting ' + this.get('id') + ' as the active channel.')
            // More stuff will go here
        },

        part: function() {
            console.log('Leaving ' + this.get('id'));
            socket.emit('part', this.get('id'));
            this.destroy();
        }

    });

    var ChannelList = Backbone.Collection.extend({ model: Channel });

    window.channels = new ChannelList;


    // VIEWS
    // =====
    var MessageView = Backbone.View.extend({

    	render: function() {
            var msg = this.model.get('sender') + ': ' + this.model.get('text');
            $(this.el).html(msg);
            return this;
    	}
    });

    var ChannelView = Backbone.View.extend({
        el: $('.channel'),

        initialize: function() {
            // channel.bind('add', this.focus, this);
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

        // Switch focus to a different channel
        focus: function(channel) {
            console.log('Focusing channel ' + channel.get('name'));
            this.focused = channel;
            this.$('.output').empty();
            this.$('.nicks').empty();

            channel.stream.each(this.addMessage);
            channel.participants.each(this.addNick);
            if (channel.get('name') == 'console')
                this.$('.nicks').hide();
            else
                this.$('.nicks').show();

            // Only the selected channel should send messages
            channels.each(function(ch) {
                ch.stream.unbind('add');
                ch.participants.unbind('add');
            });
            channel.stream.bind('add', this.addMessage, this);
            channel.participants.bind('add', this.addNick, this);
        },

        updateNicks: function(model, nicks) {
            console.log('Nicks rendered');
        }
    });

    var ChannelTabView = Backbone.View.extend({
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

        // Set as active tab; focus window on channel
        setActive: function() {
            console.log('View setting active status');
            $(this.el).addClass('active')
                .siblings().removeClass('active');
            channelWindow.focus(this.model);
        },

        render: function() {
            console.log('Rendering channel tab');
            
            var html = Mustache.to_html(this.tmpl, {text: this.model.get('id')});
            $(this.el).html(html);
            return this;
        }

        
    });

    var AppView = Backbone.View.extend({
        el: $('#content'),
        testChannels: $('#sidebar .channels'),
        channelList: $('header .channels'),

        initialize: function() {
            channels.bind('add', this.addTab, this);
            this.input = this.$('#prime-input');
            this.render();
        },

        events: {
            'keypress #prime-input': 'parseInput'
        },

        addTab: function(channel) {
            var tab = new ChannelTabView({model: channel});
            this.channelList.append(tab.el);
            tab.setActive();
        },

        joinChannel: function(name) {
            socket.emit('join', name);
        },

        // Should be launch point for parsing / commands and such
        // in due time
        parseInput: function(e) {
            if (e.keyCode != 13) return;
            var channel = channelWindow.focused;
            if (this.input.val().trim().indexOf('/') === 0) {
                console.log('IRC command detected -- sending to server');
                socket.emit('command', this.input.val().trim().substr(1));
            } else {
                socket.emit('say', {
                    target: channel.get('id'),
                    message: this.input.val()
                });
                channel.stream.add({sender: msg.from, text: msg.text});
            }

            this.input.val('');
        },

        render: function() {
            // Dynamically assign height
            $(window).resize(function() {
                sizeContent($('.channel .output'));
                sizeContent($('.channel .nicks'));
            });
        }

    });

    var channelWindow = new ChannelView,
        app = new AppView;
    
    // Create the status "channel"
    channels.add({id: 'status'});

    // Set output window to full height, minus other elements
    function sizeContent(sel) {
        var newHeight = $('html').height() - $('header').outerHeight(true) - 
                        $('#prime-input').outerHeight(true) - 
                        (sel.outerHeight(true) - sel.height()) - 10;
                        // (10 = #content padding)
        sel.height(newHeight);
    } 

    sizeContent($('.channel .output'));
    sizeContent($('.channel .nicks'));

    // VERY TEMPORARY -- JUST FOR TESTING
    $('#sidebar .channels li').click(function() {
        var name = $(this).text();
        app.joinChannel(name);
    });

    $('#sidebar .channels li .close').click(function() {
        var name = $(this).parent().text();
        console.log('Leaving ' + name);
        socket.emit('leave', {name: name})
    });



    socket.on('message', function(msg) {
        // Look for channel that matches the 'to'
        // property for the message from the server
        channel = channels.getByName(msg.to);
        if (channel) {
        	channel.stream.add({sender: msg.from, text: msg.text});
        }
    });

    socket.on('motd', function(data) {
        data.motd.split('\n').forEach(function(line) {
            channels.get('status').stream.add({sender: '', text: line});
        });
    });

    socket.on('join', function(data) {
        console.log('Join event received for ' + data.channel + ' - ' + data.nick);
        if (data.nick == me.get('nick')) {
            channels.add({id: data.channel});
        }
    });

    socket.on('names', function(data) {
        channel = channels.get(data.channel);
        console.log(data.nicks);
        console.log(channel);
        for (var nick in data.nicks) {
            channel.participants.add({nick: nick, opStatus: data.nicks[nick]});
        }
    });

});