document.getElementById('switch-to-signup').addEventListener('click', function() {
    document.getElementById('login-container').classList .add('hidden');
    document.getElementById('signup-container').classList.remove('hidden');
});

document.getElementById('switch-to-login').addEventListener('click', function() {
    document.getElementById('signup-container').classList.add('hidden');
    document.getElementById('login-container').classList.remove('hidden');
});