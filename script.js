// Menu Hambúrguer Responsivo
document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            
            // Animação do hambúrguer
            const spans = menuToggle.querySelectorAll('span');
            if (navMenu.classList.contains('active')) {
                spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
            } else {
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        });

        // Fechar menu ao clicar em um link
        const navLinks = navMenu.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('active');
                const spans = menuToggle.querySelectorAll('span');
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            });
        });

        // Fechar menu ao clicar fora
        document.addEventListener('click', function(event) {
            const isClickInsideNav = navMenu.contains(event.target);
            const isClickOnToggle = menuToggle.contains(event.target);
            
            if (!isClickInsideNav && !isClickOnToggle && navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
                const spans = menuToggle.querySelectorAll('span');
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        });
    }
});

// Funções para Modais
function abrirModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Previne scroll do body
    }
}

function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto'; // Restaura scroll do body
    }
}

// Fechar modal ao clicar fora do conteúdo
document.addEventListener('DOMContentLoaded', function() {
    const modals = document.querySelectorAll('.modal');
    
    modals.forEach(modal => {
        modal.addEventListener('click', function(event) {
            // Se clicar no overlay (fora do modal-content), fecha o modal
            if (event.target === modal) {
                modal.classList.remove('active');
                document.body.style.overflow = 'auto';
            }
        });
    });

    // Fechar modal com tecla ESC
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            modals.forEach(modal => {
                if (modal.classList.contains('active')) {
                    modal.classList.remove('active');
                    document.body.style.overflow = 'auto';
                }
            });
        }
    });
});

// Formulário de Contato
document.addEventListener('DOMContentLoaded', function() {
    const contatoForm = document.getElementById('contatoForm');
    
    if (contatoForm) {
        contatoForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            // Coleta os dados do formulário
            const formData = {
                nome: document.getElementById('nome').value,
                email: document.getElementById('email').value,
                assunto: document.getElementById('assunto').value,
                mensagem: document.getElementById('mensagem').value
            };

            // Validação básica
            if (!formData.nome || !formData.email || !formData.assunto || !formData.mensagem) {
                alert('Por favor, preencha todos os campos obrigatórios.');
                return;
            }

            // Validação de email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) {
                alert('Por favor, insira um email válido.');
                return;
            }

            // Envia via EmailJS
            emailjs.send('empresacangaco@gmail.com', 'template_r9hcfeg', {
                from_name: formData.nome,
                from_email: formData.email,
                subject: formData.assunto,
                message: formData.mensagem
            })
            .then(function() {
                alert('Mensagem enviada com sucesso! Entraremos em contato em breve.');
                contatoForm.reset();
            }, function(error) {
                alert('Erro ao enviar mensagem. Tente novamente ou entre em contato pelo WhatsApp.');
                console.error('Erro EmailJS:', error);
            });
        });
    }
});

// Smooth scroll para links âncora
document.addEventListener('DOMContentLoaded', function() {
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(event) {
            const href = this.getAttribute('href');
            
            if (href !== '#' && href.length > 1) {
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    event.preventDefault();
                    
                    const offsetTop = targetElement.offsetTop - 80; // Altura da navbar
                    
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
});

// Animação de scroll suave para elementos
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.addEventListener('DOMContentLoaded', function() {
    const animatedElements = document.querySelectorAll('.produto-card, .produto-card-full, .contato-card, .sobre-content');
    
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Scroll suave para links index.html e index.html#sobre
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-menu a[href="index.html"], .nav-menu a[href="index.html#sobre"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            
            // Se o link é para index.html#sobre
            if (href === 'index.html#sobre') {
                // Se já está na página index.html
                if (currentPage === 'index.html' || currentPage === '' || currentPage === 'index.html') {
                    e.preventDefault();
                    const sobreSection = document.getElementById('sobre');
                    if (sobreSection) {
                        const offsetTop = sobreSection.offsetTop - 80; // Altura da navbar
                        window.scrollTo({
                            top: offsetTop,
                            behavior: 'smooth'
                        });
                    }
                }
                // Se não está na página index.html, deixa o navegador seguir o link normalmente
                // e depois faz scroll quando a página carregar
            }
            // Se o link é para index.html (sem âncora)
            else if (href === 'index.html') {
                // Se já está na página index.html
                if (currentPage === 'index.html' || currentPage === '' || currentPage === 'index.html') {
                    e.preventDefault();
                    window.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                }
                // Se não está na página index.html, deixa o navegador seguir o link normalmente
            }
        });
    });
    
    // Se a página carregou com hash #sobre, faz scroll suave
    if (window.location.hash === '#sobre') {
        setTimeout(() => {
            const sobreSection = document.getElementById('sobre');
            if (sobreSection) {
                const offsetTop = sobreSection.offsetTop - 80;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        }, 100);
    }
});

// Botão Voltar ao Topo
document.addEventListener('DOMContentLoaded', function() {
    // Cria o botão
    const backToTopButton = document.createElement('button');
    backToTopButton.className = 'back-to-top';
    backToTopButton.setAttribute('aria-label', 'Voltar ao topo');
    backToTopButton.innerHTML = '<i class="fas fa-arrow-up"></i>';
    document.body.appendChild(backToTopButton);

    // Mostra/oculta o botão baseado no scroll
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
    });

    // Scroll suave ao clicar no botão
    backToTopButton.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
});