$(function() {

    window.Message = Backbone.Model.extend({
        sender: '',
        channel: '',
        text: ''
    });

    window.Stream = Backbone.Collection.extend({
        model: Message
        
    });

    var stream = new Stream;

    window.MessageView = Backbone.View.extend({

    	render: function() {
           $(this.el).html(this.model.get('text'));
           return this;
    	}
    	
    });

    window.ChannelView = Backbone.View.extend({
        el: $('#cont'),

        initialize: function() {
            // this.render();
            stream.bind('add', this.add, this);
        },

    	add: function(message) {
           var view = new MessageView({model: message});
           $(this.el).append(view.render().el);

    	},

        render: function() {
            $(this.el).html('<div class="channel"/>');
            return this;
        }

    });

    // var AppView = Backbone.View.extend({
        
    // });
    var channel = new ChannelView;
    // var app = new AppView;

    var socket = io.connect('http://localhost');

    socket.on('message', function(obj) {
        console.log(obj);
    	stream.add({sender: obj.from, channel: obj.to, text: obj.message});
    });

});