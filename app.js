$(function() {

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
        initialize: function() {
            this.stream = new Stream;
            console.log('Joining ' + this.get('name'));
            socket.emit('join', {name: this.get('name')});
            // this.setActive();
        },

        setActive: function() {
            console.log('Setting ' + this.get('name') + ' as the active channel.')
            // More stuff will go here
        }
    });

    var ChannelList = Backbone.Collection.extend({
        model: Channel
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
        el: $('.channel .output'),

        initialize: function() {
            channels.bind('add', this.focus, this);
            _.bindAll(this);
        },

    	addMessage: function(message) {
           var view = new MessageView({model: message});
           $(this.el).append(view.render().el);
    	},

        focus: function(channel) {
            console.log('Focusing channel ' + channel.get('name'));
            $(this.el).empty();
            channel.stream.each(this.addMessage);
            // Only the selected channel should send messages
            channels.each(function(ch) { ch.stream.unbind('add'); });
            channel.stream.bind('add', this.addMessage, this);
        }
    });

    var ChannelTabView = Backbone.View.extend({
        tagName: 'li',
        initialize: function() {
            this.render();
            this.model.bind('activate', this.setActive, this);
        },

        events: {
            'click': 'setActive',
            'click .close': 'leave'
        },

        leave: function() {
            
        },

        setActive: function() {
            console.log('View setting active status');
            $(this.el).addClass('active')
                .siblings().removeClass('active');
            channelWindow.focus(this.model);
        },

        render: function() {
            console.log('Rendering channel tab');
            $(this.el).text(this.model.get('name'));
            return this;
        }

        
    });

    var AppView = Backbone.View.extend({
        el: $('#content'),
        testChannels: $('#sidebar .channels'),
        channelList: $('header .channels'),

        initialize: function() {
            channels.bind('add', this.addTab, this);
        },

        addTab: function(channel) {
            var tab = new ChannelTabView({model: channel});
            this.channelList.append(tab.el);
            tab.setActive();
        },

        addWindow: function(channel) {
        },

        joinChannel: function(name) {
            channels.add({name: name});
        }

    });

    var channelWindow = new ChannelView,
        app = new AppView;

    // VERY TEMPORARY -- JUST FOR TESTING
    $('.channels li').click(function() {
        var name = $(this).text();
        app.joinChannel(name);
    });

    $('.channels li .close').click(function() {
        var name = $(this).paren().text();
        console.log('Leaving ' + name);
        socket.emit('leave', {name: name})
    });


    var socket = io.connect('http://localhost');

    socket.on('message', function(obj) {
        // Look for channel that matches the 'to'
        // property for the message from the server
        var channel = channels.detect(function(ch) {
            return ch.get('name') === obj.to;
        });
        if (channel) {
        	channel.stream.add({sender: obj.from, text: obj.message});
        }
    });

});