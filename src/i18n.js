import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    lng: 'ko', // 기본 언어를 명시적으로 한국어로 설정
    fallbackLng: 'ko',
    debug: process.env.NODE_ENV === 'development',
    interpolation: {
      escapeValue: false,
    },
    resources: {
      ko: {
        translation: {
          // 네비게이션
          nav: {
            home: '홈',
            portfolio: '포트폴리오',
            studio: '스튜디오',
            practiceRoom: '연습실',
            booking: '예약',
            contact: '문의하기',
            about: '소개',
            stories: '스토리'
          },
          
          // 홈 페이지
          home: {
            hero: {
              title: '스튜디오 놀',
              subtitle: '당신의 음악을 다음 레벨로 끌어올리세요',
              cta: '예약하기'
            },
            services: {
              title: '서비스',
              recording: {
                title: '레코딩',
                description: '최신 장비로 고품질 레코딩을 제공합니다.'
              },
              mixing: {
                title: '믹싱',
                description: '전문적인 믹싱 서비스로 완벽한 사운드를 만듭니다.'
              },
              mastering: {
                title: '마스터링',
                description: '음악에 마지막 터치를 더해 완성도를 높입니다.'
              },
              practiceRoom: {
                title: '연습실',
                description: '음향 처리가 된 전문 연습실을 제공합니다.'
              }
            }
          },
          
          // 스토리 페이지
          stories: {
            title: '스토리',
            description: '스튜디오 놀에서 진행된 다양한 프로젝트와 이야기를 만나보세요.',
            loading: '스토리를 불러오는 중...',
            notFound: '스토리가 없습니다.',
            backToList: '목록으로 돌아가기',
            categories: {
              all: '전체'
            }
          },
          
          // 스토리 상세 페이지
          storyDetail: {
            loading: '스토리를 불러오는 중...',
            notFound: '스토리를 찾을 수 없습니다.',
            backToStories: '스토리 목록으로 돌아가기',
            author: '작성자',
            share: '공유하기',
            shareSuccess: '링크가 클립보드에 복사되었습니다.',
            gallery: '갤러리',
            relatedStories: '관련 스토리',
            comingSoon: '곧 새로운 스토리가 업데이트됩니다.'
          },
          
          // 샘플 스토리 데이터 (테스트용)
          sampleStories: {
            story1: {
              title: '새 음악 스튜디오 개장 소식',
              category: '소식',
              summary: '스튜디오 놀이 새로운 장비로 확장된 공간을 오픈합니다. 새로운 시설에서 더 다양한 서비스를 제공할 예정입니다.'
            },
            story2: {
              title: '유명 아티스트와의 레코딩 세션',
              category: '레코딩',
              summary: '유명 아티스트와 함께한 레코딩 세션 동안의 경험과 노하우를 공유합니다.'
            },
            story3: {
              title: '신인 밴드 마스터링 프로젝트',
              category: '마스터링',
              summary: '신인 밴드의 데뷔 앨범을 마스터링하며 경험한 흥미와 도전에 대한 이야기입니다.'
            }
          },
          
          // 샘플 스토리 상세 데이터 (테스트용)
          sampleStory: {
            title: '새 음악 스튜디오 개장 소식',
            category: '소식',
            author: '관리자',
            content: '<p>스튜디오 놀이 새로운 장비로 확장된 공간을 오픈합니다. 새로운 시설에서 더 다양한 서비스를 제공할 예정입니다.</p><p>최신 레코딩 장비와 함께 전문적인 음향 엔지니어가 여러분의 음악을 다음 레벨로 이끌어드리겠습니다.</p><p>새로운 스튜디오 공간은 더 넓고 편안한 환경에서 최고의 음악을 만들 수 있도록 설계되었습니다.</p>'
          },
          
          // 관리자 페이지 번역
          admin: {
            // 로그인 페이지
            login: {
              title: '관리자 로그인',
              subtitle: '스토리를 관리하기 위해 로그인하세요',
              email: '이메일',
              emailPlaceholder: '관리자 이메일 입력',
              password: '비밀번호',
              passwordPlaceholder: '비밀번호 입력',
              loginButton: '로그인',
              loggingIn: '로그인 중...',
              errorMessage: '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.'
            },
            
            // 대시보드 페이지
            dashboard: {
              title: '스토리 관리',
              addStory: '새 스토리 추가',
              logout: '로그아웃',
              loading: '스토리를 불러오는 중...',
              noStories: '등록된 스토리가 없습니다.',
              addFirstStory: '첫 번째 스토리 추가하기',
              confirmDelete: '정말로 이 스토리를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
              deleteError: '스토리 삭제 중 오류가 발생했습니다.',
              table: {
                thumbnail: '썸네일',
                title: '제목',
                category: '카테고리',
                date: '날짜',
                actions: '작업',
                edit: '편집',
                delete: '삭제'
              }
            },
            
            // 스토리 폼 페이지
            storyForm: {
              addTitle: '새 스토리 추가',
              editTitle: '스토리 편집',
              loading: '스토리 데이터를 불러오는 중...',
              titleLabel: '제목',
              categoryLabel: '카테고리',
              selectCategory: '카테고리 선택',
              authorLabel: '작성자',
              dateLabel: '날짜',
              summaryLabel: '요약',
              contentLabel: '내용',
              thumbnailLabel: '썸네일',
              uploadThumbnail: '썸네일 업로드',
              thumbnailHelp: '썸네일은 스토리 목록에서 표시되는 대표 이미지입니다.',
              imagesLabel: '추가 이미지',
              addImage: '이미지 추가',
              imagesHelp: '추가 이미지는 스토리 상세 페이지의 갤러리에 표시됩니다.',
              noImage: '이미지 없음',
              saveButton: '저장하기',
              saving: '저장 중...'
            }
          }
        }
      },
      en: {
        translation: {
          // 네비게이션
          nav: {
            home: 'Home',
            portfolio: 'Portfolio',
            studio: 'Studio',
            practiceRoom: 'Practice Room',
            booking: 'Booking',
            contact: 'Contact',
            about: 'About',
            stories: 'Stories'
          },
          
          // 홈 페이지
          home: {
            hero: {
              title: 'Studio Nol',
              subtitle: 'Take your music to the next level',
              cta: 'Book Now'
            },
            services: {
              title: 'Services',
              recording: {
                title: 'Recording',
                description: 'High-quality recording with state-of-the-art equipment.'
              },
              mixing: {
                title: 'Mixing',
                description: 'Professional mixing services to perfect your sound.'
              },
              mastering: {
                title: 'Mastering',
                description: 'Add the final touch to your music to increase its quality.'
              },
              practiceRoom: {
                title: 'Practice Room',
                description: 'Professional practice rooms with acoustic treatment.'
              }
            }
          },
          
          // 스토리 페이지
          stories: {
            title: 'Stories',
            description: 'Discover various projects and stories from Studio Nol.',
            loading: 'Loading stories...',
            notFound: 'No stories found.',
            backToList: 'Back to list',
            categories: {
              all: 'All'
            }
          },
          
          // 스토리 상세 페이지
          storyDetail: {
            loading: 'Loading story...',
            notFound: 'Story not found.',
            backToStories: 'Back to stories',
            author: 'Author',
            share: 'Share',
            shareSuccess: 'Link copied to clipboard.',
            gallery: 'Gallery',
            relatedStories: 'Related Stories',
            comingSoon: 'New stories coming soon.'
          },
          
          // 샘플 스토리 데이터 (테스트용)
          sampleStories: {
            story1: {
              title: 'New Music Studio Expansion',
              category: 'News',
              summary: 'Studio Nol opens an expanded space with new equipment. We plan to offer more diverse services in the new facility.'
            },
            story2: {
              title: 'Recording Session with Famous Artist',
              category: 'Recording',
              summary: 'Sharing experiences and know-how from a recording session with a famous artist.'
            },
            story3: {
              title: 'Mastering Project for New Band',
              category: 'Mastering',
              summary: 'The story of challenges and breakthroughs experienced while mastering a debut album for a new band.'
            }
          },
          
          // 샘플 스토리 상세 데이터 (테스트용)
          sampleStory: {
            title: 'New Music Studio Expansion',
            category: 'News',
            author: 'Admin',
            content: '<p>Studio Nol opens an expanded space with new equipment. We plan to offer more diverse services in the new facility.</p><p>With the latest recording equipment and professional sound engineers, we will take your music to the next level.</p><p>The new studio space is designed to create the best music in a more spacious and comfortable environment.</p>'
          },
          
          // 관리자 페이지 번역
          admin: {
            // 로그인 페이지
            login: {
              title: 'Admin Login',
              subtitle: 'Sign in to manage stories',
              email: 'Email',
              emailPlaceholder: 'Enter admin email',
              password: 'Password',
              passwordPlaceholder: 'Enter password',
              loginButton: 'Sign In',
              loggingIn: 'Signing in...',
              errorMessage: 'Failed to login. Please check your email and password.'
            },
            
            // 대시보드 페이지
            dashboard: {
              title: 'Manage Stories',
              addStory: 'Add New Story',
              logout: 'Logout',
              loading: 'Loading stories...',
              noStories: 'No stories found.',
              addFirstStory: 'Add Your First Story',
              confirmDelete: 'Are you sure you want to delete this story? This action cannot be undone.',
              deleteError: 'An error occurred while deleting the story.',
              table: {
                thumbnail: 'Thumbnail',
                title: 'Title',
                category: 'Category',
                date: 'Date',
                actions: 'Actions',
                edit: 'Edit',
                delete: 'Delete'
              }
            },
            
            // 스토리 폼 페이지
            storyForm: {
              addTitle: 'Add New Story',
              editTitle: 'Edit Story',
              loading: 'Loading story data...',
              titleLabel: 'Title',
              categoryLabel: 'Category',
              selectCategory: 'Select Category',
              authorLabel: 'Author',
              dateLabel: 'Date',
              summaryLabel: 'Summary',
              contentLabel: 'Content',
              thumbnailLabel: 'Thumbnail',
              uploadThumbnail: 'Upload Thumbnail',
              thumbnailHelp: 'The thumbnail is the main image displayed in the story list.',
              imagesLabel: 'Additional Images',
              addImage: 'Add Image',
              imagesHelp: 'Additional images will be displayed in the gallery on the story detail page.',
              noImage: 'No Image',
              saveButton: 'Save',
              saving: 'Saving...'
            }
          }
        }
      }
    }
  });

export default i18n;
