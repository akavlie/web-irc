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

    var Channel = Backbone.Model.extend({
        // expected properties:
        // - name
        // - participants
        initialize: function() {
            this.stream = new Stream;
            // Only join true channels
            if (this.get('name').indexOf('#') == 0) {
                console.log('Joining ' + this.get('name'));
                socket.emit('join', this.get('name'));
            }
        },

        setActive: function() {
            console.log('Setting ' + this.get('name') + ' as the active channel.')
            // More stuff will go here
        },

        part: function() {
            console.log('Leaving ' + this.get('name'));
            socket.emit('part', this.get('name'));
            this.destroy();
        }

    });

    var ChannelList = Backbone.Collection.extend({
        model: Channel,

        getByName: function(name) {
            return this.detect(function(channel) {
                return channel.get('name') === name;
            });
        }
    });

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

        // Switch focus to a different channel
        focus: function(channel) {
            console.log('Focusing channel ' + channel.get('name'));
            this.$('.output').empty();
            channel.stream.each(this.addMessage);
            // Only the selected channel should send messages
            channels.each(function(ch) {
                ch.stream.unbind('add');
                ch.unbind('change:participants');
            });
            channel.stream.bind('add', this.addMessage, this);
            channel.bind('change:participants', this.updateNicks, this);
            this.focused = channel;
        },

        updateNicks: function(model, nicks) {
            _.keys(nicks).forEach(function(nick) {
                // TODO: Use a template or something here
                this.$('.nicks').append('<div>' + nick + '</div>');
            });
            this.$('.nicks').show();
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

        setActive: function() {
            console.log('View setting active status');
            $(this.el).addClass('active')
                .siblings().removeClass('active');
            channelWindow.focus(this.model);
        },

        render: function() {
            console.log('Rendering channel tab');
            
            var html = Mustache.to_html(this.tmpl, {text: this.model.get('name')});
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
            channels.add({name: name});
        },

        // Should be launch point for parsing / commands and such
        // in due time
        parseInput: function(e) {
            if (e.keyCode != 13) return;
            var channel = channelWindow.focused;
            socket.emit('say', {
                target: channel.get('name'),
                message: this.input.val()
            });
            channel.stream.add({sender: msg.from, text: msg.text});
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
    
    // Create the console "channel"
    app.joinChannel('console');

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
        var name = $(this).paren().text();
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

    socket.on('motd', function(motd) {
        console.log(motd);
        motd.split('\n').forEach(function(line) {
            channels.getByName('console').stream.add({sender: '', text: line});
        });
    });

    socket.on('names', function(data) {
        channel = channels.getByName(data.channel);
        console.log(data.nicks);
        console.log(channel);
        channel.set({participants: data.nicks});
    });

});